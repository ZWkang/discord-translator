import { AppError, isLanguage, isRecord } from './messages';
import { discordMessageUrl } from './discord-route';
import { historyFilterKey, type DeletionStamp, type HistoryDetail, type HistoryEntry, type HistoryFilters, type HistoryPage, type HistoryQuery, type HistorySource, type MessageSource, type TranslationKey } from './history-types';

export const historyDatabaseName = 'discord-translator-history';
export const historyPageSize = 30; // Display pagination, never a retention limit.
const stores = ['entries', 'sources', 'meta'];
const number = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const id = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value);
const invalid = () => new AppError({ kind: 'history_invalid', message: '翻译记录格式损坏，请检查本地记录；数据未被清除。' });
export const deleted = () => new AppError({ kind: 'history_deleted', message: '记录已被删除，本次结果不会重新保存。' });

function entry(value: unknown): HistoryEntry {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-f0-9]{64}$/.test(value.id)
    || value.siteOrigin !== 'https://discord.com' || value.provider !== 'openrouter'
    || typeof value.model !== 'string' || !value.model || !isLanguage(value.targetLanguage)
    || !number(value.promptVersion) || value.promptVersion === 0
    || typeof value.sourceText !== 'string' || !value.sourceText.trim()
    || typeof value.translatedText !== 'string' || !value.translatedText.trim()
    || !number(value.createdAt) || !number(value.updatedAt) || !number(value.lastUsedAt)
    || !number(value.createdSequence) || value.createdSequence === 0) throw invalid();
  return {
    id: value.id, siteOrigin: value.siteOrigin, provider: value.provider, model: value.model,
    targetLanguage: value.targetLanguage, promptVersion: value.promptVersion, sourceText: value.sourceText,
    translatedText: value.translatedText, createdAt: value.createdAt, createdSequence: value.createdSequence,
    updatedAt: value.updatedAt, lastUsedAt: value.lastUsedAt,
  };
}
function source(value: unknown): HistorySource {
  if (!isRecord(value) || typeof value.entryId !== 'string' || !/^[a-f0-9]{64}$/.test(value.entryId)
    || !id(value.guildId) || !id(value.channelId) || !id(value.messageId)
    || typeof value.pageTitle !== 'string' || !number(value.firstSeenAt) || !number(value.lastSeenAt)
    || value.sourceUrl !== discordMessageUrl({ guildId: value.guildId, channelId: value.channelId, messageId: value.messageId })) throw invalid();
  return { entryId: value.entryId, guildId: value.guildId, channelId: value.channelId, messageId: value.messageId,
    pageTitle: value.pageTitle, sourceUrl: value.sourceUrl as string, firstSeenAt: value.firstSeenAt, lastSeenAt: value.lastSeenAt };
}
function compatible(value: HistoryEntry, key: TranslationKey) {
  for (const field of ['id', 'siteOrigin', 'provider', 'model', 'targetLanguage', 'promptVersion', 'sourceText'] as const) {
    if (value[field] !== key[field]) throw invalid();
  }
  return value;
}
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}
function walk(value: IDBRequest<IDBCursorWithValue | null>, visit: (cursor: IDBCursorWithValue) => Promise<boolean>): Promise<void> {
  return new Promise((resolve, reject) => {
    value.onerror = () => reject(value.error);
    value.onsuccess = () => {
      const cursor = value.result;
      if (!cursor) { resolve(); return; }
      void visit(cursor).then((more) => { if (more) cursor.continue(); else resolve(); }, reject);
    };
  });
}
export function historyFailure(error: unknown, operation: 'read' | 'write'): AppError {
  if (error instanceof AppError) return error;
  const names = ['QuotaExceededError', 'AbortError', 'UnknownError', 'InvalidStateError', 'NotFoundError', 'VersionError', 'SecurityError', 'DataError', 'TransactionInactiveError', 'ConstraintError', 'DataCloneError'];
  const storageCode = isRecord(error) && typeof error.name === 'string' && names.includes(error.name) ? error.name : undefined;
  const message = operation === 'read' ? '无法读取本地翻译记录，请重试或检查扩展后台。'
    : storageCode === 'QuotaExceededError' ? '浏览器本地存储空间不足，译文未保存。' : '本地翻译记录保存失败，请检查扩展后台。';
  return new AppError({ kind: operation === 'read' ? 'history_read' : 'history_write',
    message: `${message}${storageCode ? `（${storageCode}）` : ''}`, ...(storageCode ? { storageCode } : {}) });
}

export function createTranslationMemory(options: { name?: string; factory?: IDBFactory; now?: () => number } = {}) {
  const name = options.name ?? historyDatabaseName;
  const factory = options.factory ?? globalThis.indexedDB;
  const now = options.now ?? Date.now;
  let opening: Promise<IDBDatabase> | undefined;
  function open() {
    if (opening) return opening;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const attempt = factory.open(name, 1);
      let abandoned = false;
      attempt.onblocked = () => {
        abandoned = true;
        reject(new AppError({ kind: 'history_read', message: '翻译记录升级被其他连接阻止，请关闭旧记录页后重试。' }));
      };
      attempt.onupgradeneeded = () => {
        if (abandoned) { attempt.transaction!.abort(); return; }
        const db = attempt.result;
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('created', ['createdAt', 'createdSequence'], { unique: true });
        const sources = db.createObjectStore('sources', { keyPath: ['entryId', 'guildId', 'channelId', 'messageId'] });
        sources.createIndex('entry', 'entryId');
        sources.createIndex('guildEntry', ['guildId', 'entryId']);
        sources.createIndex('channelEntry', ['guildId', 'channelId', 'entryId']);
        db.createObjectStore('meta');
      };
      attempt.onerror = () => reject(historyFailure(attempt.error, 'read'));
      attempt.onsuccess = () => {
        const db = attempt.result;
        if (abandoned) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = undefined; };
        resolve(db);
      };
    });
    opening = pending;
    void pending.catch(() => { if (opening === pending) opening = undefined; });
    return pending;
  }
  async function run<T>(mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    try {
      const tx = (await open()).transaction(stores, mode);
      const completion = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
      });
      const work = fn(tx).catch((error) => {
        try { tx.abort(); } catch { /* A failed request may already have aborted the transaction. */ }
        throw error;
      });
      const [value] = await Promise.all([work, completion]);
      return value;
    } catch (error) { throw historyFailure(error, mode === 'readonly' ? 'read' : 'write'); }
  }
  async function counter(tx: IDBTransaction, key: string): Promise<number> {
    const value: unknown = await request(tx.objectStore('meta').get(key));
    if (value === undefined) return 0; // Uninitialized counters start at zero.
    if (!number(value)) throw invalid();
    return value;
  }
  async function stampIn(tx: IDBTransaction, entryId: string): Promise<DeletionStamp> {
    const [collection, version] = await Promise.all([counter(tx, 'collection'), counter(tx, `entry:${entryId}`)]);
    return { collection, entry: version };
  }
  async function check(tx: IDBTransaction, entryId: string, stamp: DeletionStamp) {
    const current = await stampIn(tx, entryId);
    if (current.collection !== stamp.collection || current.entry !== stamp.entry) throw deleted();
  }
  async function readEntry(tx: IDBTransaction, entryId: string): Promise<HistoryEntry | undefined> {
    const value: unknown = await request(tx.objectStore('entries').get(entryId));
    return value === undefined ? undefined : entry(value);
  }
  async function addSource(tx: IDBTransaction, entryId: string, snapshot: MessageSource, time: number) {
    const store = tx.objectStore('sources');
    const prior: unknown = await request(store.get([entryId, snapshot.guildId, snapshot.channelId, snapshot.messageId]));
    const record = source({ ...snapshot, entryId, firstSeenAt: prior === undefined ? time : source(prior).firstSeenAt, lastSeenAt: time });
    await request(store.put(record));
  }
  async function inspect(key: TranslationKey) {
    return run('readonly', async (tx) => {
      const [stamp, found] = await Promise.all([stampIn(tx, key.id), readEntry(tx, key.id)]);
      return { stamp, entry: found && compatible(found, key) };
    });
  }
  async function lookup(key: TranslationKey, stamp: DeletionStamp) {
    return run('readonly', async (tx) => {
      await check(tx, key.id, stamp);
      const found = await readEntry(tx, key.id);
      return found && compatible(found, key);
    });
  }
  async function associate(key: TranslationKey, snapshot: MessageSource, stamp: DeletionStamp) {
    return run('readwrite', async (tx) => {
      await check(tx, key.id, stamp);
      const found = await readEntry(tx, key.id);
      if (!found) throw deleted();
      const value = { ...compatible(found, key), lastUsedAt: now() };
      await addSource(tx, key.id, snapshot, value.lastUsedAt);
      await request(tx.objectStore('entries').put(value));
      return value;
    });
  }
  async function save(key: TranslationKey, translatedText: string, snapshot: MessageSource, stamp: DeletionStamp, replace: boolean) {
    return run('readwrite', async (tx) => {
      await check(tx, key.id, stamp);
      const previous = await readEntry(tx, key.id);
      if (previous) compatible(previous, key);
      const time = now();
      let value: HistoryEntry;
      if (previous) {
        value = { ...previous, lastUsedAt: time, ...(replace ? { translatedText, updatedAt: time } : {}) };
      } else {
        const sequence = (await counter(tx, 'sequence')) + 1;
        value = { ...key, translatedText, createdAt: time, updatedAt: time, lastUsedAt: time, createdSequence: sequence };
        await request(tx.objectStore('meta').put(sequence, 'sequence'));
      }
      value = entry(value);
      await request(tx.objectStore('entries').put(value));
      await addSource(tx, key.id, snapshot, time);
      return value;
    });
  }
  async function get(entryId: string): Promise<HistoryDetail> {
    return run('readonly', async (tx) => {
      const found = await readEntry(tx, entryId);
      if (!found) throw new AppError({ kind: 'history_not_found', message: '这条翻译记录已不存在，请刷新列表。' });
      const sources: HistorySource[] = (await request(tx.objectStore('sources').index('entry').getAll(entryId))).map(source);
      return { entry: found, sources };
    });
  }
  async function list(query: HistoryQuery): Promise<HistoryPage> {
    return run('readonly', async (tx) => {
      const filterKey = historyFilterKey(query);
      if (query.cursor && query.cursor.filterKey !== filterKey) throw new AppError({ kind: 'invalid_request', message: '筛选条件已改变，请从第一页重新查询。' });
      const upperSequence = query.cursor?.upperSequence ?? await counter(tx, 'sequence');
      const range = query.cursor ? IDBKeyRange.upperBound(query.cursor.before, true) : undefined;
      const items: HistoryEntry[] = [];
      let more = false;
      const needle = (query.query ?? '').toLocaleLowerCase();
      await walk(tx.objectStore('entries').index('created').openCursor(range, 'prev'), async (cursor) => {
        const value = entry(cursor.value);
        if (value.createdSequence > upperSequence || (query.model && value.model !== query.model)
          || (query.targetLanguage && value.targetLanguage !== query.targetLanguage)
          || (needle && !`${value.sourceText}\n${value.translatedText}`.toLocaleLowerCase().includes(needle))) return true;
        if (query.guildId) {
          const index = tx.objectStore('sources').index(query.channelId ? 'channelEntry' : 'guildEntry');
          const key = query.channelId ? [query.guildId, query.channelId, value.id] : [query.guildId, value.id];
          if (!await request(index.count(key))) return true;
        }
        if (items.length === historyPageSize) { more = true; return false; }
        items.push(value);
        return true;
      });
      const last = items.at(-1);
      return { items, nextCursor: more && last ? { upperSequence, before: [last.createdAt, last.createdSequence], filterKey } : null };
    });
  }
  async function filters(): Promise<HistoryFilters> {
    return run('readonly', async (tx) => {
      const models = new Set<string>();
      const languages = new Set<HistoryEntry['targetLanguage']>();
      const guildIds = new Set<string>();
      const channels = new Map<string, HistorySource>();
      await walk(tx.objectStore('entries').openCursor(), async (cursor) => {
        const value = entry(cursor.value);
        models.add(value.model); languages.add(value.targetLanguage);
        return true;
      });
      await walk(tx.objectStore('sources').openCursor(), async (cursor) => {
        const value = source(cursor.value);
        guildIds.add(value.guildId);
        const key = `${value.guildId}/${value.channelId}`;
        if (!channels.has(key) || channels.get(key)!.lastSeenAt <= value.lastSeenAt) channels.set(key, value);
        return true;
      });
      return { models: [...models].sort(), targetLanguages: [...languages].sort(), guildIds: [...guildIds].sort(),
        channels: [...channels.values()].map(({ guildId, channelId, pageTitle }) => ({ guildId, channelId, pageTitle })) };
    });
  }
  async function remove(entryId: string) {
    return run('readwrite', async (tx) => {
      const version = await counter(tx, `entry:${entryId}`);
      await request(tx.objectStore('meta').put(version + 1, `entry:${entryId}`));
      await request(tx.objectStore('entries').delete(entryId));
      await walk(tx.objectStore('sources').index('entry').openCursor(IDBKeyRange.only(entryId)), async (cursor) => {
        await request(cursor.delete()); return true;
      });
    });
  }
  async function clear() {
    return run('readwrite', async (tx) => {
      const [collection, sequence] = await Promise.all([counter(tx, 'collection'), counter(tx, 'sequence')]);
      for (const store of stores) await request(tx.objectStore(store).clear());
      await request(tx.objectStore('meta').put(collection + 1, 'collection'));
      await request(tx.objectStore('meta').put(sequence, 'sequence'));
    });
  }
  async function close() { if (opening) { (await opening).close(); opening = undefined; } }
  return { inspect, lookup, associate, save, get, list, filters, remove, clear, close };
}

export type TranslationMemory = ReturnType<typeof createTranslationMemory>;
