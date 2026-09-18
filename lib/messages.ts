export const languages = { 'zh-CN': '简体中文', en: 'English', ja: '日本語', ko: '한국어' } as const;
export type TargetLanguage = keyof typeof languages;
export interface SettingsDraft { apiKey: string; model: string; targetLanguage: TargetLanguage; autoTranslate: boolean }
export interface Settings extends SettingsDraft { revision: string }
export interface PublicSettings { hasApiKey: boolean; model: string; targetLanguage: TargetLanguage; revision: string; autoTranslate: boolean }
export type ErrorKind = 'invalid_request' | 'forbidden' | 'settings_error' | 'missing_configuration'
  | 'configuration_changed' | 'auto_translation_disabled' | 'model_incompatible' | 'authentication' | 'payment' | 'rate_limit' | 'provider' | 'network' | 'connection' | 'response';
export interface TranslationError {
  kind: ErrorKind;
  message: string;
  status?: number;
  code?: number;
  providerRequestId?: string;
  retryAfterSeconds?: number;
}
export class AppError extends Error {
  constructor(public readonly detail: TranslationError) { super(detail.message); this.name = 'AppError'; }
}
export const connectionError = (): TranslationError => ({
  kind: 'connection', message: '扩展连接中断，请重试；若扩展已更新，请刷新 Discord。',
});
export type Reply<T> = { ok: true; data: T } | { ok: false; error: TranslationError };
export interface TranslationRequest {
  type: 'translation.request';
  requestId: string;
  channelId: string;
  messageId: string;
  sourceText: string;
  settingsRevision: string;
  automatic?: boolean;
}
export interface TranslationResult {
  requestId: string;
  settingsRevision: string;
  targetLanguage: TargetLanguage;
  model: string;
  translatedText: string;
}
export type TranslationReply = Reply<TranslationResult> & { requestId: string };
export type Request =
  | { type: 'settings.get' | 'settings.getPublic' | 'settings.clearKey' | 'settings.open' }
  | { type: 'settings.save'; settings: SettingsDraft }
  | { type: 'settings.setAutoTranslate'; enabled: boolean }
  | TranslationRequest;
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isLanguage(value: unknown): value is TargetLanguage {
  return typeof value === 'string' && Object.hasOwn(languages, value);
}
export function publicSettings(settings: Settings): PublicSettings {
  return { hasApiKey: settings.apiKey.length > 0, model: settings.model, targetLanguage: settings.targetLanguage, revision: settings.revision, autoTranslate: settings.autoTranslate };
}
export function parseDraft(value: unknown): SettingsDraft {
  if (!isRecord(value) || typeof value.apiKey !== 'string' || typeof value.model !== 'string' || !isLanguage(value.targetLanguage) || typeof value.autoTranslate !== 'boolean') {
    throw new AppError({ kind: 'invalid_request', message: '设置格式不正确。' });
  }
  const draft = { apiKey: value.apiKey.trim(), model: value.model.trim(), targetLanguage: value.targetLanguage, autoTranslate: value.autoTranslate };
  if (!draft.apiKey || !draft.model) throw new AppError({ kind: 'missing_configuration', message: '请填写 OpenRouter API Key 和模型 ID。' });
  return draft;
}
export function parseRequest(value: unknown): Request {
  if (!isRecord(value)) throw new AppError({ kind: 'invalid_request', message: '扩展请求格式不正确。' });
  switch (value.type) {
    case 'settings.get': case 'settings.getPublic': case 'settings.clearKey': case 'settings.open': return { type: value.type };
    case 'settings.save': return { type: value.type, settings: parseDraft(value.settings) };
    case 'settings.setAutoTranslate': {
      if (typeof value.enabled !== 'boolean') throw new AppError({ kind: 'invalid_request', message: '自动翻译开关必须为布尔值。' });
      return { type: value.type, enabled: value.enabled };
    }
    case 'translation.request': {
      const { requestId, channelId, messageId, sourceText, settingsRevision } = value;
      if (typeof requestId !== 'string' || !requestId || typeof channelId !== 'string' || !/^\d+$/.test(channelId)
        || typeof messageId !== 'string' || !/^\d+$/.test(messageId) || typeof sourceText !== 'string'
        || !sourceText.trim() || typeof settingsRevision !== 'string'
        || (value.automatic !== undefined && typeof value.automatic !== 'boolean')) {
        throw new AppError({ kind: 'invalid_request', message: '翻译请求缺少有效的消息正文或身份。' });
      }
      return { type: value.type, requestId, channelId, messageId, sourceText, settingsRevision, ...(value.automatic ? { automatic: true } : {}) };
    }
    default: throw new AppError({ kind: 'invalid_request', message: '未知的扩展操作。' });
  }
}
