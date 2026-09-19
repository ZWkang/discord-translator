import { describe, expect, it, vi } from 'vitest';
import { TranslationState } from '@/lib/translation-state';
import type { PublicSettings, TranslationReply, TranslationRequest } from '@/lib/messages';
const settings: PublicSettings = { hasApiKey: true, model: 'provider/model', targetLanguage: 'zh-CN', revision: 's1', autoTranslate: false };
const source = () => ({ url: 'https://discord.com/channels/7/10', pageTitle: '#test | Discord' });
function setup() {
  const pending: { request: TranslationRequest; resolve: (reply: TranslationReply) => void }[] = [];
  const send = vi.fn((request: TranslationRequest) => new Promise<TranslationReply>((resolve) => pending.push({ request, resolve })));
  const state = new TranslationState({ settings: async () => settings, source, translate: send });
  state.channel('10');
  state.configure(settings);
  const succeed = (index: number, text: string) => {
    const { request, resolve } = pending[index]!;
    resolve({ ok: true, requestId: request.requestId, data: { ...request, model: settings.model, targetLanguage: 'zh-CN', translatedText: text, origin: 'model', entryId: 'a'.repeat(64), persistence: { status: 'saved' } } });
  };
  return { state, pending, send, succeed };
}
describe('message lifecycle', () => {
  it('keeps the previous result through regeneration, duplicate clicks and failed persistence', async () => {
    const { state, pending, send, succeed } = setup();
    const first = state.translate('1', 'A'); await Promise.resolve(); succeed(0, 'old'); await first;
    const refreshing = state.translate('1', 'A', false, true);
    await state.translate('1', 'A', false, true);
    expect(state.get('1')).toMatchObject({ status: 'success', translatedText: 'old', regeneration: { status: 'loading' } });
    expect(send).toHaveBeenCalledTimes(2);
    const { request, resolve } = pending[1]!;
    expect(request.forceRefresh).toBe(true);
    resolve({ ok: true, requestId: request.requestId, data: { ...request, model: settings.model, targetLanguage: 'zh-CN', entryId: 'a'.repeat(64), origin: 'model', translatedText: 'candidate', persistence: { status: 'not-saved', error: { kind: 'history_write', message: 'save failed' } } } });
    await refreshing;
    expect(state.get('1')).toMatchObject({ translatedText: 'old', regeneration: { status: 'error', candidate: 'candidate' } });
    const retry = state.translate('1', 'A', false, true); await Promise.resolve(); succeed(2, 'fresh'); await retry;
    expect(state.get('1')).toMatchObject({ status: 'success', translatedText: 'fresh' });
    expect(state.get('1')?.regeneration).toBeUndefined();
  });
  it.each(['edit', 'channel', 'settings', 'disconnect'])('does not restore an old regeneration snapshot after %s', async event => {
    const { state, pending, succeed } = setup();
    const first = state.translate('1', 'A'); await Promise.resolve(); succeed(0, 'old'); await first;
    const refresh = state.translate('1', 'A', false, true); await Promise.resolve();
    if (event === 'edit') state.bind('1', 'B');
    if (event === 'channel') state.channel('20');
    if (event === 'settings') state.configure({ ...settings, revision: 's2' });
    if (event === 'disconnect') state.disconnected();
    pending[1]!.resolve({ ok: false, requestId: pending[1]!.request.requestId, error: { kind: 'network', message: 'late failure' } });
    await refresh;
    if (event === 'disconnect') {
      expect(state.get('1')).toMatchObject({ translatedText: 'old', regeneration: { error: { kind: 'connection' } } });
    } else expect(state.get('1')?.translatedText).toBeUndefined();
  });
  it('does not dispatch an automatic request if disabled while reading configuration', async () => {
    let resolveSettings!: (value: PublicSettings) => void;
    const send = vi.fn();
    const state = new TranslationState({ settings: () => new Promise(resolve => { resolveSettings = resolve; }), source, translate: send });
    state.channel('10');
    state.configure({ ...settings, autoTranslate: true });
    const work = state.translate('1', 'A', true);
    state.configure({ ...settings, autoTranslate: false });
    resolveSettings({ ...settings, autoTranslate: true });
    await work;
    expect(send).not.toHaveBeenCalled();
    expect(state.isAutomaticEnabled()).toBe(false);
    expect(state.get('1')?.status).toBe('idle');
  });
  it('keeps an already-dispatched result when only automatic mode changes', async () => {
    const { state, succeed } = setup();
    state.configure({ ...settings, autoTranslate: true });
    const work = state.translate('1', 'A', true);
    await Promise.resolve();
    state.configure({ ...settings, autoTranslate: false });
    succeed(0, '甲');
    await work;
    expect(state.get('1')).toMatchObject({ status: 'success', translatedText: '甲' });
  });
  it('deduplicates a message and correlates independent out-of-order replies', async () => {
    const { state, send, succeed } = setup();
    const a = state.translate('1', 'A');
    expect(state.get('1')?.status).toBe('loading');
    await state.translate('1', 'A');
    const b = state.translate('2', 'B');
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(2);
    succeed(1, '乙'); await b;
    succeed(0, '甲'); await a;
    expect(state.get('1')?.translatedText).toBe('甲');
    expect(state.get('2')?.translatedText).toBe('乙');
    expect(state.bind('1', 'A').translatedText).toBe('甲');
    await state.translate('1', 'A');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it.each(['edit', 'channel', 'settings', 'disconnect'])('ignores a late response after %s', async (event) => {
    const { state, succeed } = setup();
    const work = state.translate('1', 'A'); await Promise.resolve();
    if (event === 'edit') state.bind('1', 'changed');
    if (event === 'channel') state.channel('20');
    if (event === 'settings') state.configure({ ...settings, revision: 's2' });
    if (event === 'disconnect') state.disconnected();
    succeed(0, 'stale'); await work;
    expect(state.get('1')?.translatedText).toBeUndefined();
    expect(state.get('1')?.status).not.toBe('loading');
  });
  it('ends loading on failure and only retries on another action', async () => {
    const { state, pending, send, succeed } = setup();
    const first = state.translate('1', 'A'); await Promise.resolve();
    pending[0]!.resolve({ ok: false, requestId: pending[0]!.request.requestId, error: { kind: 'network', message: 'Network failed' } });
    await first;
    expect(state.get('1')?.status).toBe('error');
    expect(send).toHaveBeenCalledOnce();
    const second = state.translate('1', 'A'); await Promise.resolve();
    succeed(1, '甲'); await second;
    expect(state.get('1')?.status).toBe('success');
  });
  it('lets the background look up records before reporting missing credentials', async () => {
    const send = vi.fn(async (request: TranslationRequest) => ({ ok: false as const, requestId: request.requestId, error: { kind: 'missing_configuration' as const, message: '请先填写配置。' } }));
    const state = new TranslationState({ settings: async () => ({ ...settings, hasApiKey: false }), source, translate: send });
    state.channel('10');
    await state.translate('1', 'A');
    expect(state.get('1')).toMatchObject({ status: 'error', error: { kind: 'missing_configuration' } });
    expect(send).toHaveBeenCalledOnce();
  });
});
