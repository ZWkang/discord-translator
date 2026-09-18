import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PublicSettings, TranslationReply, TranslationRequest } from '@/lib/messages';
import { channelFixture, messageRow } from './fixtures/discord';

// Only the browser messaging boundary is replaced. The content entrypoint,
// WXT ShadowRoot mounting, Solid components, extraction and state are real.
const runtime = vi.hoisted(() => ({
  sendMessage: vi.fn(), connect: vi.fn(), getURL: (path: string) => `chrome-extension://test${path}`,
  lastError: undefined,
}));
vi.mock('wxt/browser', () => ({ browser: { runtime } }));
vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
const { default: content } = await import('@/entrypoints/content');
const channelId = '800000000000000001';
const messageId = '900000000000000001';
const initialSettings: PublicSettings = { hasApiKey: true, model: 'provider/test', targetLanguage: 'zh-CN', revision: 's1', autoTranslate: false };
let settings: PublicSettings;
let invalidate: () => void;
let notifySettings: (message: unknown) => void;
let disconnect: () => void;
let pending: { request: TranslationRequest; resolve: (reply: TranslationReply) => void }[];
const action = () => document.querySelector('dt-translate-action')!.shadowRoot!.querySelector('button')!;
const resultText = () => document.querySelector('dt-translate-result')!.shadowRoot!.textContent!;
const waitForButton = () => vi.waitFor(() => expect(document.querySelector('dt-translate-action')?.shadowRoot?.querySelector('button')).toBeTruthy());
const complete = (text = '验收用响应', index = 0) => {
  const { request, resolve } = pending[index]!;
  resolve({ ok: true, requestId: request.requestId, data: { requestId: request.requestId, settingsRevision: request.settingsRevision, targetLanguage: 'zh-CN', model: settings.model, translatedText: text } });
};

beforeEach(async () => {
  settings = { ...initialSettings };
  pending = [];
  const cleanup: (() => void)[] = [];
  let valid = true;
  invalidate = () => { valid = false; for (const callback of cleanup) callback(); };
  runtime.connect.mockImplementation(() => ({
    onMessage: { addListener: (listener: typeof notifySettings) => { notifySettings = listener; } },
    onDisconnect: { addListener: (listener: typeof disconnect) => { disconnect = listener; } },
    disconnect: () => {},
  }));
  runtime.sendMessage.mockImplementation(async (request) => {
    if (request.type === 'settings.getPublic') return { ok: true, data: settings };
    if (request.type === 'settings.open') return { ok: true, data: null };
    return new Promise<TranslationReply>((resolve) => pending.push({ request, resolve }));
  });
  vi.stubGlobal('location', new URL(`https://discord.com/channels/7/${channelId}`));
  document.body.innerHTML = channelFixture();
  await content.main({
    get isValid() { return valid; }, get isInvalid() { return !valid; },
    onInvalidated: (callback: () => void) => { cleanup.push(callback); return () => {}; },
    addEventListener: (target: EventTarget, event: string, callback: EventListener) => {
      target.addEventListener(event, callback);
      cleanup.push(() => target.removeEventListener(event, callback));
    },
  } as unknown as ContentScriptContext);
  await waitForButton();
});
afterEach(() => { invalidate(); document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('production content UI integration', () => {
  it.each([false, true])('uses the destination URL before navigation commits (automatic=%s)', async (automatic) => {
    settings = { ...settings, autoTranslate: automatic };
    notifySettings({ type: 'settings.changed', settings });
    if (automatic) await vi.waitFor(() => expect(pending).toHaveLength(1));
    const nextChannel = '800000000000000002';
    const nextMessage = '900000000000000002';
    const oldUrl = new URL(location.href);
    const newUrl = new URL(`https://discord.com/channels/7/${nextChannel}`);
    window.dispatchEvent(Object.assign(new Event('wxt:locationchange'), { newUrl, oldUrl }));
    expect(location.href).toBe(oldUrl.href);
    vi.stubGlobal('location', newUrl);
    document.body.innerHTML = channelFixture(messageRow(nextMessage, 'New channel body').replaceAll(channelId, nextChannel));
    await waitForButton();
    expect(document.querySelectorAll('dt-translate-action')).toHaveLength(1);
    if (!automatic) action().click();
    await vi.waitFor(() => expect(pending).toHaveLength(automatic ? 2 : 1));
    expect(pending.at(-1)!.request).toMatchObject({ channelId: nextChannel, messageId: nextMessage, sourceText: 'New channel body' });
    if (automatic) {
      complete('旧频道译文', 0);
      await Promise.resolve();
      expect(resultText()).not.toContain('旧频道译文');
    }
    complete('新频道译文', automatic ? 1 : 0);
    await vi.waitFor(() => expect(resultText()).toContain('新频道译文'));
  });
  it('automatically translates mounted and incoming messages, stops future work and keeps existing results', async () => {
    settings = { ...settings, autoTranslate: true };
    notifySettings({ type: 'settings.changed', settings });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]!.request.automatic).toBe(true);
    document.querySelector('ol')!.insertAdjacentHTML('beforeend', messageRow('900000000000000002', 'Second message'));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    complete('第一条译文');
    await vi.waitFor(() => expect(resultText()).toContain('第一条译文'));
    settings = { ...settings, autoTranslate: false };
    notifySettings({ type: 'settings.changed', settings });
    complete('第二条译文', 1);
    document.querySelector('ol')!.insertAdjacentHTML('beforeend', messageRow('900000000000000003', 'Third message'));
    await vi.waitFor(() => expect(document.querySelectorAll('dt-translate-action')).toHaveLength(3));
    expect(pending).toHaveLength(2);
    expect(resultText()).toContain('第一条译文');
    settings = { ...settings, autoTranslate: true };
    notifySettings({ type: 'settings.changed', settings });
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    expect(pending[2]!.request.messageId).toBe('900000000000000003');
    complete('第三条译文', 2);
  });
  it('does not automatically retry failed messages after DOM updates or mode toggles', async () => {
    settings = { ...settings, autoTranslate: true };
    notifySettings({ type: 'settings.changed', settings });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0]!.resolve({ ok: false, requestId: pending[0]!.request.requestId, error: { kind: 'rate_limit', message: 'Rate limited' } });
    await vi.waitFor(() => expect(action().textContent).toContain('重试'));
    document.getElementById(`message-content-${messageId}`)!.classList.add('changed-style');
    settings = { ...settings, autoTranslate: false };
    notifySettings({ type: 'settings.changed', settings });
    settings = { ...settings, autoTranslate: true };
    notifySettings({ type: 'settings.changed', settings });
    expect(pending).toHaveLength(1);
    action().click();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1]!.request.automatic).toBeUndefined();
    complete('手动重试成功', 1);
  });
  it('translates the new revision of an edited message and ignores the earlier automatic response', async () => {
    settings = { ...settings, autoTranslate: true };
    notifySettings({ type: 'settings.changed', settings });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    document.getElementById(`message-content-${messageId}`)!.firstChild!.textContent = 'Updated message';
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1]!.request).toMatchObject({ sourceText: 'Updated message', automatic: true });
    complete('过期译文');
    await Promise.resolve();
    expect(resultText()).not.toContain('过期译文');
    complete('最新译文', 1);
    await vi.waitFor(() => expect(resultText()).toContain('最新译文'));
  });
  it('stops activation before it reaches Discord document listeners', async () => {
    const shortcut = vi.fn();
    const click = vi.fn();
    document.addEventListener('keydown', shortcut);
    document.addEventListener('click', click);
    try {
      action().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      action().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
      action().click();
      expect(shortcut).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      complete();
    } finally {
      document.removeEventListener('keydown', shortcut);
      document.removeEventListener('click', click);
    }
  });
  it('mounts exactly one action and result, sends once, renders text safely and restores a virtualized row', async () => {
    expect(runtime.sendMessage).not.toHaveBeenCalled();
    expect(document.querySelectorAll('dt-translate-action')).toHaveLength(1);
    action().click(); action().click();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]!.request.sourceText).toBe('The release is ready.');
    expect(action().textContent).toContain('翻译中');
    complete('<script>never execute</script>\n第二行');
    await vi.waitFor(() => expect(action().textContent).toContain('已翻译'));
    expect(resultText()).toContain('<script>never execute</script>');
    expect(document.querySelector('dt-translate-result')!.shadowRoot!.querySelector('script')).toBeNull();
    document.querySelector('li')!.remove();
    await vi.waitFor(() => expect(document.querySelector('dt-translate-result')).toBeNull());
    document.querySelector('ol')!.innerHTML = messageRow();
    await waitForButton();
    expect(action().textContent).toContain('已翻译');
    expect(pending).toHaveLength(1);
    expect(document.querySelectorAll('dt-translate-action')).toHaveLength(1);
  });
  it('checks current DOM before a reply can beat the observer frame', async () => {
    action().click();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    document.getElementById(`message-content-${messageId}`)!.firstChild!.textContent = 'Edited before reply';
    complete('stale');
    await vi.waitFor(() => expect(action().getAttribute('aria-disabled')).toBe('false'));
    expect(resultText()).not.toContain('stale');
    expect(action().getAttribute('aria-disabled')).toBe('false');
  });
  it('shows missing configuration, opens settings, and receives settings changes without translating', async () => {
    settings.hasApiKey = false;
    action().click();
    await vi.waitFor(() => expect(resultText()).toContain('请先填写'));
    expect(pending).toHaveLength(0);
    document.querySelector('dt-translate-result')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() => expect(runtime.sendMessage).toHaveBeenCalledWith({ type: 'settings.open' }));
    settings = { ...settings, hasApiKey: true, revision: 's2' };
    notifySettings({ type: 'settings.changed', settings });
    expect(resultText()).not.toContain('请先填写');
    expect(pending).toHaveLength(0);
  });
  it('ends loading when the background disconnects and ignores the old reply', async () => {
    action().click();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    disconnect();
    expect(resultText()).toContain('扩展连接中断');
    complete('late');
    await Promise.resolve();
    expect(resultText()).not.toContain('late');
    expect(action().textContent).toContain('重试');
  });
});
