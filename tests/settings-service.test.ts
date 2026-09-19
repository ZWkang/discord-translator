import { describe, expect, it, vi } from 'vitest';
import { createSettingsRepository, settingsKey } from '@/lib/settings';
import { parseRequest, publicSettings, type SettingsDraft } from '@/lib/messages';
import { createBackgroundService } from '@/lib/background-service';
import 'fake-indexeddb/auto';
import { createTranslationMemory } from '@/lib/translation-memory';

const draft: SettingsDraft = { apiKey: 'test-key-not-a-credential', model: 'provider/test-model', targetLanguage: 'zh-CN', autoTranslate: false };
function setup() {
  let values: Record<string, unknown> = {};
  const storage = { get: vi.fn(async () => values), set: vi.fn(async (input: Record<string, unknown>) => { values = { ...values, ...input }; }) };
  const settings = createSettingsRepository(storage);
  const translate = vi.fn(async () => '译文');
  const changed = vi.fn();
  const openSettings = vi.fn(async () => {});
  const memory = createTranslationMemory({ name: crypto.randomUUID() });
  const openHistory = vi.fn(async () => {});
  const handle = createBackgroundService({ extensionId: 'test', popupUrl: 'chrome-extension://test/popup.html', historyUrl: 'chrome-extension://test/history.html', ready: async () => {}, settings, memory, translate, changed, openSettings, openHistory });
  return { storage, settings, handle, translate, changed, openSettings, openHistory, memory };
}
const popup = { id: 'test', url: 'chrome-extension://test/popup.html' };
const discord = { id: 'test', frameId: 0, url: 'https://discord.com/channels/7/800000000000000001', tab: { url: 'https://discord.com/channels/7/800000000000000001' } };
const request = { type: 'translation.request', requestId: 'r1', channelId: '800000000000000001', messageId: '900000000000000001', sourceText: 'Hello', settingsRevision: 'initial', source: { url: discord.url, pageTitle: '#test | Discord' } };

describe('settings and trusted RPC boundaries', () => {
  it('uses the native current tab route after Discord SPA navigation, not the original document URL', async () => {
    const { handle, settings, translate, memory } = setup();
    const saved = await settings.save(draft);
    const currentUrl = 'https://discord.com/channels/9/200000000000000001';
    const moved = { ...discord, tab: { url: currentUrl } };
    const current = { ...request, channelId: '200000000000000001', source: { url: currentUrl, pageTitle: '#new | Discord' }, settingsRevision: saved.revision };
    expect(await handle(current, moved)).toMatchObject({ ok: true });
    expect(translate).toHaveBeenCalledOnce();
    expect((await memory.filters()).guildIds).toEqual(['9']);
    expect(await handle({ ...request, settingsRevision: saved.revision }, moved)).toMatchObject({ ok: false, error: { kind: 'invalid_request' } });
    expect(await handle(current, { ...moved, tab: {} })).toMatchObject({ ok: false, error: { kind: 'invalid_request' } });
    expect(translate).toHaveBeenCalledOnce();
    await memory.close();
  });
  it('validates source routes, refresh intent and history cursors', async () => {
    for (const input of [
      { ...request, automatic: true, forceRefresh: true },
      { ...request, source: { url: 'https://outside.example/channels/7/800000000000000001', pageTitle: 'external' } },
      { ...request, source: { url: 'https://discord.com/channels/@me/123', pageTitle: 'DM' } },
      { ...request, source: { url: 'https://discord.com/channels/7/999', pageTitle: 'other' } },
      { type: 'history.list', query: { channelId: '1' } },
      { type: 'history.list', query: { cursor: { upperSequence: -1, before: [1, 1], filterKey: 'x' } } },
      { type: 'history.get', entryId: 'invalid' },
    ]) expect(() => parseRequest(input)).toThrow();
    const { handle, settings, translate } = setup();
    const saved = await settings.save(draft);
    const result = await handle({ ...request, settingsRevision: saved.revision,
      source: { ...request.source, url: request.source.url.replace('/7/', '/9/') } }, discord);
    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid_request' } });
    expect(translate).not.toHaveBeenCalled();
  });
  it('isolates history RPCs from content and settings, without requiring a key to browse', async () => {
    const { handle, settings, translate, openHistory, memory } = setup();
    const history = { id: 'test', url: 'chrome-extension://test/history.html' };
    expect(await handle({ type: 'history.list', query: {} }, history)).toMatchObject({ ok: true, data: { items: [] } });
    expect(await handle({ type: 'history.open' }, popup)).toMatchObject({ ok: true });
    expect(openHistory).toHaveBeenCalledOnce();
    for (const role of [discord, popup, { ...history, id: 'foreign' }]) {
      for (const input of [{ type: 'history.list', query: {} }, { type: 'history.clear' }, { type: 'history.delete', entryId: 'a'.repeat(64) }]) {
        expect(await handle(input, role)).toMatchObject({ ok: false, error: { kind: 'forbidden' } });
      }
    }
    for (const input of [{ type: 'settings.get' }, { type: 'settings.clearKey' }, { type: 'settings.save', settings: draft }, request]) {
      expect(await handle(input, history)).toMatchObject({ ok: false, error: { kind: 'forbidden' } });
    }
    const saved = await settings.save(draft);
    await handle({ ...request, settingsRevision: saved.revision }, discord);
    await handle({ type: 'settings.clearKey' }, popup);
    expect((await memory.list({})).items).toHaveLength(1);
    const afterClear = await settings.get();
    expect(await handle({ ...request, settingsRevision: afterClear.revision }, discord)).toMatchObject({ ok: true, data: { origin: 'memory' } });
    expect(translate).toHaveBeenCalledOnce();
    await memory.close();
  });
  it('keeps older saved settings in manual mode and rejects malformed switch values', async () => {
    const { settings, storage } = setup();
    const { autoTranslate: _mode, ...legacy } = draft;
    await storage.set({ [settingsKey]: { ...legacy, revision: 'legacy' } });
    expect(await settings.get()).toEqual({ ...legacy, revision: 'legacy', autoTranslate: false });
    await storage.set({ [settingsKey]: { ...legacy, revision: 'legacy', autoTranslate: 'yes' } });
    await expect(settings.get()).rejects.toThrow('格式损坏');
    expect(() => parseRequest({ type: 'settings.setAutoTranslate', enabled: 'true' })).toThrow();
  });
  it('persists automatic mode without changing the translation revision, then disables it when clearing the key', async () => {
    const { settings } = setup();
    await expect(settings.setAutoTranslate(true)).rejects.toThrow('请先保存');
    const saved = await settings.save(draft);
    expect(await settings.setAutoTranslate(true)).toEqual({ ...saved, autoTranslate: true });
    expect((await settings.get()).autoTranslate).toBe(true);
    expect(await settings.setAutoTranslate(false)).toEqual(saved);
    await settings.setAutoTranslate(true);
    expect(await settings.clearKey()).toMatchObject({ apiKey: '', model: draft.model, autoTranslate: false });
  });
  it('authorizes toggle writes and stops automatic requests at the background boundary when disabled', async () => {
    const { handle, settings, translate, changed } = setup();
    const saved = await settings.save(draft);
    expect(await handle({ type: 'settings.setAutoTranslate', enabled: true }, discord)).toMatchObject({ ok: false, error: { kind: 'forbidden' } });
    const automatic = { ...request, settingsRevision: saved.revision, automatic: true };
    expect(await handle(automatic, discord)).toMatchObject({ ok: false, error: { kind: 'auto_translation_disabled' } });
    expect(translate).not.toHaveBeenCalled();
    expect(await handle({ type: 'settings.setAutoTranslate', enabled: true }, popup)).toMatchObject({ ok: true });
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ autoTranslate: true }));
    expect(await handle(automatic, discord)).toMatchObject({ ok: true });
  });
  it('reports toggle write failures without broadcasting a mode change', async () => {
    const { handle, settings, storage, changed } = setup();
    await settings.save(draft);
    storage.set.mockRejectedValueOnce(new Error('Cannot save toggle'));
    expect(await handle({ type: 'settings.setAutoTranslate', enabled: true }, popup)).toMatchObject({ ok: false });
    expect(changed).not.toHaveBeenCalled();
    expect((await settings.get()).autoTranslate).toBe(false);
  });
  it('rejects malformed requests and empty required fields', () => {
    for (const input of [null, {}, { ...request, messageId: 123 }, { ...request, sourceText: ' ' }, { type: 'settings.save', settings: { ...draft, model: ' ' } }]) {
      expect(() => parseRequest(input)).toThrow();
    }
  });
  it('persists settings, strips whitespace and exposes only public fields', async () => {
    const { settings } = setup();
    expect(await settings.get()).toMatchObject({ apiKey: '', model: '', targetLanguage: 'zh-CN' });
    const saved = await settings.save({ ...draft, apiKey: ` ${draft.apiKey} ` });
    expect(await settings.get()).toEqual(saved);
    expect(publicSettings(saved)).toEqual({ hasApiKey: true, model: draft.model, targetLanguage: 'zh-CN', revision: saved.revision, autoTranslate: false });
    expect(JSON.stringify(publicSettings(saved))).not.toContain(draft.apiKey);
    const cleared = await settings.clearKey();
    expect(cleared).toMatchObject({ apiKey: '', model: draft.model, targetLanguage: 'zh-CN' });
    expect(cleared.revision).not.toBe(saved.revision);
  });
  it('does not replace corrupt data with defaults or report failed writes as saved', async () => {
    const { settings, storage } = setup();
    await storage.set({ [settingsKey]: { apiKey: 42 } });
    await expect(settings.get()).rejects.toThrow('格式损坏');
    storage.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(settings.save(draft)).rejects.toThrow('Storage unavailable');
  });
  it('denies page access to secrets and writes, including spoofed senders', async () => {
    const { handle, settings, translate } = setup();
    await settings.save(draft);
    for (const type of ['settings.get', 'settings.clearKey']) expect(await handle({ type }, discord)).toMatchObject({ ok: false, error: { kind: 'forbidden' } });
    expect(await handle({ type: 'settings.save', settings: draft }, discord)).toMatchObject({ ok: false });
    expect(await handle({ type: 'settings.get' }, { ...popup, id: 'foreign' })).toMatchObject({ ok: false });
    expect(await handle({ type: 'settings.getPublic' }, discord)).toMatchObject({ ok: true, data: { hasApiKey: true } });
    expect(translate).not.toHaveBeenCalled();
  });
  it('saves locally without translating and broadcasts no key', async () => {
    const { handle, translate, changed } = setup();
    expect(await handle({ type: 'settings.save', settings: draft }, popup)).toMatchObject({ ok: true });
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]![0]).not.toHaveProperty('apiKey');
    expect(translate).not.toHaveBeenCalled();
  });
  it('restores settings through a fresh repository after a background restart', async () => {
    const { settings, storage } = setup();
    const saved = await settings.save(draft);
    const restarted = createSettingsRepository(storage);
    expect(publicSettings(await restarted.get())).toEqual(publicSettings(saved));
  });
  it('does not broadcast when storage rejects a save', async () => {
    const { handle, storage, changed } = setup();
    storage.set.mockRejectedValueOnce(new Error('Cannot write'));
    expect(await handle({ type: 'settings.save', settings: draft }, popup)).toMatchObject({ ok: false, error: { kind: 'settings_error' } });
    expect(changed).not.toHaveBeenCalled();
  });
  it('checks configuration and revision before sending, and correlates the response', async () => {
    const { handle, settings, translate } = setup();
    expect(await handle(request, discord)).toMatchObject({ ok: false, requestId: 'r1', error: { kind: 'missing_configuration' } });
    const saved = await settings.save(draft);
    expect(await handle(request, discord)).toMatchObject({ ok: false, error: { kind: 'configuration_changed' } });
    expect(translate).not.toHaveBeenCalled();
    expect(await handle({ ...request, settingsRevision: saved.revision }, discord)).toMatchObject({ ok: true, requestId: 'r1', data: { translatedText: '译文' } });
    expect(translate).toHaveBeenCalledWith(saved, 'Hello');
  });
});
