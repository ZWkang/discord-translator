import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import History from '@/entrypoints/history/App';
import Popup from '@/entrypoints/popup/App';
import { createBackgroundService } from '@/lib/background-service';
import { createSettingsRepository } from '@/lib/settings';
import { AppError, type Settings } from '@/lib/messages';
import { deferred, makeKey, makeMemory, makeSource } from './history-fixtures';
import type { HistoryPage } from '@/lib/history-types';

const runtime = vi.hoisted(() => ({ sendMessage: vi.fn(), getManifest: () => ({ version: '0.2.0' }) }));
vi.mock('wxt/browser', () => ({ browser: { runtime } }));
let repository: ReturnType<typeof makeMemory>;
let settings: ReturnType<typeof createSettingsRepository>;
let handle: ReturnType<typeof createBackgroundService>;
let caller: 'history' | 'popup';
let root: HTMLDivElement;
let dispose: (() => void) | undefined;
let provider: Mock<(settings: Settings, text: string) => Promise<string>>;
let openHistory: Mock<() => Promise<void>>;
const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === text)!;
const settled = () => vi.waitFor(() => expect(root.querySelector('.history-records')?.getAttribute('aria-busy')).toBe('false'));
const select = (name: string, value: string) => {
  const element = root.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
  element.value = value; element.dispatchEvent(new Event('change', { bubbles: true }));
};
async function seed(text: string, channel = '20', guild = '10') {
  const key = await makeKey({ sourceText: text });
  return repository.memory.save(key, `译文 ${text}`, makeSource(channel, String(100 + text.length), guild), (await repository.memory.inspect(key)).stamp, false);
}
beforeEach(() => {
  repository = makeMemory();
  let values: Record<string, unknown> = {};
  settings = createSettingsRepository({ get: async () => values, set: async input => { values = { ...values, ...input }; } });
  provider = vi.fn(async (_settings: Settings, _text: string) => 'provider output'); openHistory = vi.fn(async () => {});
  handle = createBackgroundService({ extensionId: 'test', popupUrl: 'chrome-extension://test/popup.html', historyUrl: 'chrome-extension://test/history.html',
    settings, memory: repository.memory, ready: async () => {}, translate: provider, changed: vi.fn(), openSettings: async () => {}, openHistory });
  caller = 'history';
  runtime.sendMessage.mockImplementation(input => handle(input, { id: 'test', url: `chrome-extension://test/${caller}.html` }));
  root = document.createElement('div'); document.body.append(root);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(async () => { dispose?.(); dispose = undefined; root.remove(); await repository.memory.close(); vi.clearAllMocks(); });

describe('history page with real repository and background RPC', () => {
  it('distinguishes an empty collection from a read failure', async () => {
    const failure = vi.spyOn(repository.memory, 'list').mockRejectedValueOnce(new AppError({ kind: 'history_read', message: 'record read failed' }));
    dispose = render(() => createComponent(History, {}), root);
    await settled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('record read failed');
    expect(root.querySelector('.history-empty')).toBeNull();
    failure.mockRestore(); button('重新加载').click(); await settled();
    expect(root.querySelector('.history-empty')?.textContent).toContain('第一条译文');
    expect(provider).not.toHaveBeenCalled();
  });
  it('combines source filters and search, and shows safe full text and actual source links', async () => {
    const entry = await seed('<script>literal</script>\ncode line', '20', '10');
    await seed('other channel', '21', '10');
    await seed('another guild', '22', '11');
    dispose = render(() => createComponent(History, {}), root); await settled();
    expect(root.querySelectorAll('.history-entry')).toHaveLength(3);
    select('服务器', '10'); await settled();
    select('频道', '20'); await settled();
    const input = root.querySelector<HTMLInputElement>('#history-search')!;
    input.value = 'CODE'; input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settled();
    expect(root.querySelectorAll('.history-entry')).toHaveLength(1);
    expect(root.querySelector<HTMLSelectElement>('select[aria-label="频道"]')!.value).toBe('20');
    root.querySelector<HTMLButtonElement>('[aria-label="查看词条详情"]')!.click();
    await vi.waitFor(() => expect(root.querySelector('.history-sources a')).not.toBeNull());
    expect(root.querySelector('.history-full-text')?.textContent).toBe(entry.sourceText);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('a')?.getAttribute('href')).toBe(makeSource('20', String(100 + entry.sourceText.length), '10').sourceUrl);
    expect(root.querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(provider).not.toHaveBeenCalled();
  });
  it('does not let a late old query replace a newer filter result', async () => {
    await seed('A', '20', '10'); const newest = await seed('B', '21', '11');
    dispose = render(() => createComponent(History, {}), root); await settled();
    const original = repository.memory.list.bind(repository.memory);
    const delayed = deferred<HistoryPage>();
    vi.spyOn(repository.memory, 'list').mockImplementationOnce(() => delayed.promise).mockImplementation(original);
    select('服务器', '10'); select('服务器', '11'); await settled();
    delayed.resolve(await original({ guildId: '10' })); await Promise.resolve(); await Promise.resolve();
    expect([...root.querySelectorAll('.history-entry')].map(item => item.getAttribute('data-entry-id'))).toEqual([newest.id]);
  });
  it('loads all pages without moving a reused entry, and only sees new records after refresh', async () => {
    for (let i = 0; i < 32; i++) await seed(`Entry ${i}`);
    const old = (await repository.memory.list({})).items[25]!;
    dispose = render(() => createComponent(History, {}), root); await settled();
    expect(root.querySelectorAll('.history-entry')).toHaveLength(30);
    await repository.memory.associate(old, makeSource(), (await repository.memory.inspect(old)).stamp);
    await seed('created during pagination');
    button('加载更早记录').click(); await settled();
    expect(root.querySelectorAll('.history-entry')).toHaveLength(32);
    expect(new Set([...root.querySelectorAll('.history-entry')].map(e => e.getAttribute('data-entry-id'))).size).toBe(32);
    button('刷新记录').click(); await settled();
    expect(root.querySelector('.history-entry')?.textContent).toContain('created during pagination');
  });
  it('cancels deletion, retains records on failure and clears all guilds despite the active filter', async () => {
    const a = await seed('A', '20', '10'); await seed('B', '21', '11');
    dispose = render(() => createComponent(History, {}), root); await settled();
    const trigger = root.querySelector<HTMLButtonElement>('[aria-label="删除词条"]')!;
    trigger.click(); button('取消').click();
    expect(document.activeElement).toBe(trigger);
    expect((await repository.memory.list({})).items).toHaveLength(2);
    const failure = vi.spyOn(repository.memory, 'remove').mockRejectedValueOnce(new AppError({ kind: 'history_write', message: 'delete failed' }));
    trigger.click(); button('确认删除').click();
    await vi.waitFor(() => expect(root.querySelector('dialog [role="alert"]')?.textContent).toContain('delete failed'));
    expect(root.querySelectorAll('.history-entry')).toHaveLength(2);
    failure.mockRestore(); button('取消').click();
    select('服务器', '10'); await settled();
    button('清空全部记录').click();
    expect(root.querySelector('dialog')?.textContent).toContain('不限于当前筛选结果');
    button('确认清空全部').click();
    await vi.waitFor(() => expect(root.querySelector('dialog')?.hasAttribute('open')).toBe(false)); await settled();
    expect((await repository.memory.list({})).items).toHaveLength(0);
    expect(root.querySelector<HTMLSelectElement>('select[aria-label="服务器"]')!.value).toBe('10');
    await expect(repository.memory.get(a.id)).rejects.toThrow('不存在');
    expect(provider).not.toHaveBeenCalled();
  });
  it('opens history from an incomplete settings form without saving it', async () => {
    caller = 'popup';
    dispose = render(() => createComponent(Popup, {}), root);
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>('#model')?.disabled).toBe(false));
    const model = root.querySelector<HTMLInputElement>('#model')!;
    model.value = 'unsaved/model'; model.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('.dt-history-open')!.click();
    await vi.waitFor(() => expect(openHistory).toHaveBeenCalledOnce());
    expect((await settings.get()).model).toBe('');
    expect(model.value).toBe('unsaved/model');
    expect(provider).not.toHaveBeenCalled();
  });
});
