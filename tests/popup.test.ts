import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import Popup from '@/entrypoints/popup/App';
import { createSettingsRepository } from '@/lib/settings';
import { createBackgroundService } from '@/lib/background-service';
import { AppError } from '@/lib/messages';
import { makeMemory } from './history-fixtures';

const runtime = vi.hoisted(() => ({ sendMessage: vi.fn(), getManifest: () => ({ version: '0.2.0' }) }));
vi.mock('wxt/browser', () => ({ browser: { runtime } }));
let settings: ReturnType<typeof createSettingsRepository>;
let repository: ReturnType<typeof makeMemory>;
let root: HTMLDivElement;
let dispose: (() => void) | undefined;
const provider = vi.fn(async () => 'provider output');
const draft = { apiKey: 'test-key', model: 'qwen/qwen-2.5-7b-instruct', targetLanguage: 'zh-CN', autoTranslate: false } as const;
const choice = () => root.querySelector<HTMLSelectElement>('#model')!;
const custom = () => root.querySelector<HTMLInputElement>('#custom-model')!;
const ready = () => vi.waitFor(() => expect(root.querySelector('form')?.getAttribute('aria-busy')).toBe('false'));
const select = (value: string) => { choice().value = value; choice().dispatchEvent(new Event('change', { bubbles: true })); };
const fill = (selector: string, value: string) => {
  const input = root.querySelector<HTMLInputElement>(selector)!;
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
};
const submit = async () => { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await ready(); };
const mount = async () => { dispose?.(); dispose = render(() => createComponent(Popup, {}), root); await ready(); };

beforeEach(() => {
  let values: Record<string, unknown> = {};
  settings = createSettingsRepository({ get: async () => values, set: async input => { values = { ...values, ...input }; } });
  repository = makeMemory();
  const handle = createBackgroundService({ extensionId: 'test', popupUrl: 'chrome-extension://test/popup.html', historyUrl: 'chrome-extension://test/history.html',
    settings, memory: repository.memory, ready: async () => {}, translate: provider, changed: vi.fn(), openSettings: async () => {}, openHistory: async () => {} });
  runtime.sendMessage.mockImplementation(input => handle(input, { id: 'test', url: 'chrome-extension://test/popup.html' }));
  root = document.createElement('div'); document.body.append(root);
});
afterEach(async () => { dispose?.(); dispose = undefined; root.remove(); await repository.memory.close(); vi.clearAllMocks(); });

describe('popup model selection through real settings RPC', () => {
  it('requires an explicit model choice and rejects an empty custom ID', async () => {
    await mount();
    expect(choice().value).toBe('');
    expect(root.querySelector('.dt-model-price')).toBeNull();
    fill('#api-key', 'test-key');
    await submit();
    expect(root.querySelector('#model-error')?.textContent).toBe('请选择翻译模型');
    select('custom'); fill('#custom-model', '  '); await submit();
    expect(root.querySelector('#model-error')?.textContent).toBe('请填写模型 ID');
    expect((await settings.get()).revision).toBe('initial');
    expect(provider).not.toHaveBeenCalled();
  });

  it('keeps preset changes as drafts until saved and restores each exact ID', async () => {
    await settings.save(draft); await mount();
    expect(choice().value).toBe(draft.model);
    expect(root.querySelector<HTMLInputElement>('#api-key')?.type).toBe('password');
    for (const id of ['qwen/qwen3-30b-a3b-instruct-2507', 'mistralai/ministral-3b-2512', 'google/gemini-2.5-flash-lite', draft.model]) {
      const previous = await settings.get();
      select(id);
      expect(root.querySelector('#custom-model')).toBeNull();
      expect(root.querySelector<HTMLAnchorElement>('#model-help a')?.href).toBe(`https://openrouter.ai/${id}`);
      expect(root.querySelector('#model-help')?.textContent).toContain('2026-09-20');
      expect(root.querySelector('#model-help')?.textContent).toContain('百万 token');
      expect(await settings.get()).toEqual(previous);
      await submit(); expect((await settings.get()).model).toBe(id);
      await mount(); expect(choice().value).toBe(id);
    }
    expect(provider).not.toHaveBeenCalled();
  });

  it('preserves a legacy custom model and its unsaved draft across preset changes and clearing the key', async () => {
    await settings.save({ ...draft, model: 'provider/legacy-model' }); await mount();
    expect(choice().value).toBe('custom'); expect(custom().value).toBe('provider/legacy-model');
    fill('#custom-model', '  provider/new-model  ');
    select(draft.model); select('custom');
    expect(custom().value).toBe('  provider/new-model  ');
    expect((await settings.get()).model).toBe('provider/legacy-model');
    expect(root.querySelector('.dt-model-price')).toBeNull();
    await submit(); await mount();
    expect(custom().value).toBe('provider/new-model');
    root.querySelector<HTMLButtonElement>('.dt-clear')!.click(); await ready();
    expect(await settings.get()).toMatchObject({ apiKey: '', model: 'provider/new-model', autoTranslate: false });
    expect(choice().value).toBe('custom'); expect(custom().value).toBe('provider/new-model');
    expect(provider).not.toHaveBeenCalled();
  });

  it('keeps a failed-save selection visible without replacing persisted settings', async () => {
    await settings.save(draft); await mount();
    select('mistralai/ministral-3b-2512');
    vi.spyOn(settings, 'save').mockRejectedValueOnce(new AppError({ kind: 'settings_error', message: 'storage write failed' }));
    await submit();
    expect(root.querySelector('.dt-feedback-error')?.textContent).toContain('storage write failed');
    expect(choice().value).toBe('mistralai/ministral-3b-2512');
    expect((await settings.get()).model).toBe(draft.model);
    expect(provider).not.toHaveBeenCalled();
  });
});
