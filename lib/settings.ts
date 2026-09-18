import { AppError, isLanguage, isRecord, parseDraft, type Settings } from './messages';
export const settingsKey = 'translation-settings:v1';
export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
export function createSettingsRepository(storage: SettingsStorage) {
  async function get(): Promise<Settings> {
    const item = (await storage.get(settingsKey))[settingsKey];
    if (item === undefined) return { apiKey: '', model: '', targetLanguage: 'zh-CN', revision: 'initial', autoTranslate: false };
    if (!isRecord(item) || typeof item.apiKey !== 'string' || typeof item.model !== 'string'
      || !isLanguage(item.targetLanguage) || typeof item.revision !== 'string'
      || (item.autoTranslate !== undefined && typeof item.autoTranslate !== 'boolean')) {
      throw new AppError({ kind: 'settings_error', message: '本地设置格式损坏，请重新保存设置。' });
    }
    // Version 1 records predating the switch retain their manual-only behavior.
    return { apiKey: item.apiKey, model: item.model, targetLanguage: item.targetLanguage, revision: item.revision, autoTranslate: item.autoTranslate === true };
  }
  async function save(input: unknown): Promise<Settings> {
    const settings = { ...parseDraft(input), revision: crypto.randomUUID() };
    await storage.set({ [settingsKey]: settings });
    return settings;
  }
  async function clearKey(): Promise<Settings> {
    const settings = { ...await get(), apiKey: '', autoTranslate: false, revision: crypto.randomUUID() };
    await storage.set({ [settingsKey]: settings });
    return settings;
  }
  async function setAutoTranslate(enabled: boolean): Promise<Settings> {
    const current = await get();
    if (enabled && (!current.apiKey || !current.model)) {
      throw new AppError({ kind: 'missing_configuration', message: '请先保存 OpenRouter API Key 和模型，再开启自动翻译。' });
    }
    // Mode changes do not invalidate completed or already-started translations.
    const settings = { ...current, autoTranslate: enabled };
    await storage.set({ [settingsKey]: settings });
    return settings;
  }
  return { get, save, clearKey, setAutoTranslate };
}
