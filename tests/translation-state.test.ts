import { describe, expect, it, vi } from 'vitest';
import { TranslationState } from '@/lib/translation-state';
import type { PublicSettings, TranslationReply, TranslationRequest } from '@/lib/messages';
const settings: PublicSettings = { hasApiKey: true, model: 'provider/model', targetLanguage: 'zh-CN', revision: 's1', autoTranslate: false };
function setup() {
  const pending: { request: TranslationRequest; resolve: (reply: TranslationReply) => void }[] = [];
  const send = vi.fn((request: TranslationRequest) => new Promise<TranslationReply>((resolve) => pending.push({ request, resolve })));
  const state = new TranslationState({ settings: async () => settings, translate: send });
  state.channel('10');
  state.configure(settings);
  const succeed = (index: number, text: string) => {
    const { request, resolve } = pending[index]!;
    resolve({ ok: true, requestId: request.requestId, data: { ...request, model: settings.model, targetLanguage: 'zh-CN', translatedText: text } });
  };
  return { state, pending, send, succeed };
}
describe('message lifecycle', () => {
  it('does not dispatch an automatic request if disabled while reading configuration', async () => {
    let resolveSettings!: (value: PublicSettings) => void;
    const send = vi.fn();
    const state = new TranslationState({ settings: () => new Promise(resolve => { resolveSettings = resolve; }), translate: send });
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
  it('shows missing configuration without a model request', async () => {
    const send = vi.fn();
    const state = new TranslationState({ settings: async () => ({ ...settings, hasApiKey: false }), translate: send });
    state.channel('10');
    await state.translate('1', 'A');
    expect(state.get('1')).toMatchObject({ status: 'error', error: { kind: 'missing_configuration' } });
    expect(send).not.toHaveBeenCalled();
  });
});
