import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createTranslationMemory, historyPageSize } from '@/lib/translation-memory';
import { createTranslationKey } from '@/lib/translation-key';
import { makeKey, makeMemory, makeSource, identity, settings } from './history-fixtures';

describe('persistent translation memory', () => {
  it('keys only exact translation inputs, independent of credentials and revisions', async () => {
    const key = await makeKey();
    expect(key.id).toMatch(/^[a-f0-9]{64}$/);
    expect((await createTranslationKey({ ...identity, ...settings, apiKey: 'another', revision: 'new' } as typeof identity)).id).toBe(key.id);
    for (const changes of [{ sourceText: 'hello\nworld' }, { sourceText: 'Hello world' }, { sourceText: 'Hello\nworld!' }, { model: 'provider/other' }, { targetLanguage: 'ja' as const }, { promptVersion: 2 }]) {
      expect((await makeKey(changes)).id).not.toBe(key.id);
    }
  });
  it('commits complete text and sources, deduplicates associations and survives reopening', async () => {
    const { memory, factory, name } = makeMemory();
    const key = await makeKey();
    const { stamp, entry } = await memory.inspect(key);
    expect(entry).toBeUndefined();
    expect(await memory.list({})).toEqual({ items: [], nextCursor: null });
    const saved = await memory.save(key, '你好\n```code```', makeSource(), stamp, false);
    await memory.associate(key, makeSource('21'), stamp);
    await memory.associate(key, makeSource('21'), stamp);
    expect((await memory.get(key.id)).sources).toHaveLength(2);
    expect((await memory.list({ guildId: '10', channelId: '21', query: 'CODE', model: settings.model })).items).toHaveLength(1);
    expect((await memory.list({ guildId: '99' })).items).toHaveLength(0);
    const persisted = (await memory.get(key.id)).entry;
    expect(persisted.lastUsedAt).toBeGreaterThanOrEqual(saved.lastUsedAt);
    await memory.close();
    const reopened = createTranslationMemory({ factory, name });
    expect((await reopened.get(key.id)).entry).toEqual(persisted);
    expect((await reopened.filters()).channels).toHaveLength(2);
    await reopened.close();
  });
  it('rolls back the entry and sequence if source validation fails, and retains old text on failed replacement', async () => {
    const { memory } = makeMemory();
    const key = await makeKey();
    const { stamp } = await memory.inspect(key);
    const corrupt = { ...makeSource(), sourceUrl: 'https://outside.example/' };
    await expect(memory.save(key, 'new', corrupt, stamp, false)).rejects.toMatchObject({ detail: { kind: 'history_invalid' } });
    expect((await memory.list({})).items).toHaveLength(0);
    const saved = await memory.save(key, 'old', makeSource(), stamp, false);
    expect(saved.createdSequence).toBe(1);
    await expect(memory.save(key, 'new', corrupt, stamp, true)).rejects.toThrow();
    expect((await memory.get(key.id)).entry.translatedText).toBe('old');
    await memory.close();
  });
  it('updates explicitly while preserving creation identity and all sources; ordinary saves cannot overwrite', async () => {
    let time = 100;
    const { memory } = makeMemory(() => time);
    const key = await makeKey();
    const { stamp } = await memory.inspect(key);
    const original = await memory.save(key, 'old', makeSource(), stamp, false);
    time = 200;
    const refreshed = await memory.save(key, 'new', makeSource('21'), stamp, true);
    expect(refreshed).toMatchObject({ translatedText: 'new', createdAt: 100, createdSequence: original.createdSequence, updatedAt: 200 });
    await memory.save(key, 'stale', makeSource('22'), stamp, false);
    expect((await memory.get(key.id)).entry.translatedText).toBe('new');
    expect((await memory.get(key.id)).sources).toHaveLength(3);
    await memory.close();
  });
  it('keeps pagination stable across hits, regeneration and new entries with tied timestamps', async () => {
    const { memory } = makeMemory(() => 100);
    const keys = [];
    for (let i = 0; i < historyPageSize + 5; i++) {
      const key = await makeKey({ sourceText: `Source ${i}` }); keys.push(key);
      await memory.save(key, `译文 ${i}`, makeSource('20', String(100 + i)), (await memory.inspect(key)).stamp, false);
    }
    const first = await memory.list({});
    expect(first.items).toHaveLength(historyPageSize);
    await memory.associate(keys[0]!, makeSource('21'), (await memory.inspect(keys[0]!)).stamp);
    await memory.save(keys[1]!, 'new', makeSource(), (await memory.inspect(keys[1]!)).stamp, true);
    const newest = await makeKey({ sourceText: 'later' });
    await memory.save(newest, '后来', makeSource(), (await memory.inspect(newest)).stamp, false);
    const second = await memory.list({ cursor: first.nextCursor! });
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map(e => e.id)).size).toBe(historyPageSize + 5);
    expect(second.nextCursor).toBeNull();
    expect((await memory.list({})).items[0]!.id).toBe(newest.id);
    await expect(memory.list({ query: 'changed', cursor: first.nextCursor! })).rejects.toMatchObject({ detail: { kind: 'invalid_request' } });
    await memory.close();
  });
  it('deletes all associations, fences stale writes, and permits genuinely new operations', async () => {
    const { memory } = makeMemory();
    const key = await makeKey();
    const stamp = (await memory.inspect(key)).stamp;
    await memory.save(key, 'old', makeSource(), stamp, false);
    await memory.associate(key, makeSource('21'), stamp);
    await memory.remove(key.id);
    expect((await memory.filters()).channels).toHaveLength(0);
    await expect(memory.save(key, 'late', makeSource(), stamp, true)).rejects.toMatchObject({ detail: { kind: 'history_deleted' } });
    const nextStamp = (await memory.inspect(key)).stamp;
    await memory.save(key, 'new', makeSource(), nextStamp, false);
    const sequence = (await memory.get(key.id)).entry.createdSequence;
    await memory.clear();
    await expect(memory.associate(key, makeSource(), nextStamp)).rejects.toThrow('删除');
    await expect(memory.save(key, 'late', makeSource(), nextStamp, false)).rejects.toThrow('删除');
    const after = await memory.save(key, 'after clear', makeSource(), (await memory.inspect(key)).stamp, false);
    expect(after.createdSequence).toBeGreaterThan(sequence);
    await memory.close();
  });
  it('surfaces opening failures without manufacturing an empty collection', async () => {
    const factory = { open: () => { throw new DOMException('Denied', 'SecurityError'); } } as unknown as IDBFactory;
    const memory = createTranslationMemory({ factory });
    await expect(memory.list({})).rejects.toMatchObject({ detail: { kind: 'history_read' } });
  });
  it('keeps records and sources intact when a clear transaction fails halfway through', async () => {
    const { memory } = makeMemory();
    const key = await makeKey();
    await memory.save(key, 'keep', makeSource(), (await memory.inspect(key)).stamp, false);
    const original = IDBObjectStore.prototype.clear;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'clear').mockImplementation(function (this: IDBObjectStore) {
      if (this.name === 'sources') throw new DOMException('Write failed', 'UnknownError');
      return original.call(this);
    });
    try { await expect(memory.clear()).rejects.toMatchObject({ detail: { kind: 'history_write' } }); }
    finally { failure.mockRestore(); }
    expect((await memory.get(key.id)).entry.translatedText).toBe('keep');
    expect((await memory.get(key.id)).sources).toHaveLength(1);
    await memory.close();
  });
  it('does not silently replace malformed stored data or expose additional stored fields', async () => {
    const { memory, factory, name } = makeMemory();
    const key = await makeKey();
    const saved = await memory.save(key, 'valid', makeSource(), (await memory.inspect(key)).stamp, false);
    const db = await new Promise<IDBDatabase>(resolve => { const req = factory.open(name); req.onsuccess = () => resolve(req.result); });
    const put = (value: unknown) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('entries', 'readwrite'); tx.objectStore('entries').put(value); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    await put({ ...saved, unexpectedPrivateField: 'do-not-return' });
    expect((await memory.get(key.id)).entry).not.toHaveProperty('unexpectedPrivateField');
    await put({ ...saved, translatedText: null });
    await expect(memory.inspect(key)).rejects.toMatchObject({ detail: { kind: 'history_invalid' } });
    await expect(memory.list({})).rejects.toMatchObject({ detail: { kind: 'history_invalid' } });
    db.close(); await memory.close();
  });
  it('reports a genuinely blocked upgrade and abandons it without changing the old database', async () => {
    const factory = new IDBFactory();
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open('blocked', 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    // Exercise the browser's blocked event with a held older connection.
    const upgradeFactory = { open: () => factory.open('blocked', 2) } as unknown as IDBFactory;
    const memory = createTranslationMemory({ factory: upgradeFactory });
    await expect(memory.list({})).rejects.toThrow('升级被其他连接阻止');
    old.close();
  });
});
