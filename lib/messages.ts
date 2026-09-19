import type { HistoryQuery, MemoryResult } from './history-types';
import { parseDiscordChannel } from './discord-route';

export const languages = { 'zh-CN': '简体中文', en: 'English', ja: '日本語', ko: '한국어' } as const;
export type TargetLanguage = keyof typeof languages;
export interface SettingsDraft { apiKey: string; model: string; targetLanguage: TargetLanguage; autoTranslate: boolean }
export interface Settings extends SettingsDraft { revision: string }
export interface PublicSettings { hasApiKey: boolean; model: string; targetLanguage: TargetLanguage; revision: string; autoTranslate: boolean }
export type ErrorKind = 'invalid_request' | 'forbidden' | 'settings_error' | 'missing_configuration'
  | 'configuration_changed' | 'auto_translation_disabled' | 'model_incompatible' | 'authentication' | 'payment' | 'rate_limit' | 'provider' | 'network' | 'connection' | 'response'
  | 'history_read' | 'history_write' | 'history_deleted' | 'history_invalid' | 'history_not_found';
export interface TranslationError {
  kind: ErrorKind;
  message: string;
  status?: number;
  code?: number;
  providerRequestId?: string;
  retryAfterSeconds?: number;
  storageCode?: string;
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
  forceRefresh?: boolean;
  source: { url: string; pageTitle: string };
}
export interface TranslationResult extends MemoryResult {
  requestId: string;
  settingsRevision: string;
  targetLanguage: TargetLanguage;
  model: string;
}
export type TranslationReply = Reply<TranslationResult> & { requestId: string };
export type Request =
  | { type: 'settings.get' | 'settings.getPublic' | 'settings.clearKey' | 'settings.open' }
  | { type: 'settings.save'; settings: SettingsDraft }
  | { type: 'settings.setAutoTranslate'; enabled: boolean }
  | { type: 'history.open' | 'history.filters' | 'history.clear' }
  | { type: 'history.list'; query: HistoryQuery }
  | { type: 'history.get' | 'history.delete'; entryId: string }
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
    case 'history.open': case 'history.filters': case 'history.clear': return { type: value.type };
    case 'history.get': case 'history.delete': {
      if (typeof value.entryId !== 'string' || !/^[a-f0-9]{64}$/.test(value.entryId)) throw new AppError({ kind: 'invalid_request', message: '记录标识不正确。' });
      return { type: value.type, entryId: value.entryId };
    }
    case 'history.list': return { type: value.type, query: parseHistoryQuery(value.query) };
    case 'settings.setAutoTranslate': {
      if (typeof value.enabled !== 'boolean') throw new AppError({ kind: 'invalid_request', message: '自动翻译开关必须为布尔值。' });
      return { type: value.type, enabled: value.enabled };
    }
    case 'translation.request': {
      const { requestId, channelId, messageId, sourceText, settingsRevision } = value;
      if (typeof requestId !== 'string' || !requestId || typeof channelId !== 'string' || !/^\d+$/.test(channelId)
        || typeof messageId !== 'string' || !/^\d+$/.test(messageId) || typeof sourceText !== 'string'
        || !sourceText.trim() || typeof settingsRevision !== 'string'
        || (value.automatic !== undefined && typeof value.automatic !== 'boolean')
        || (value.forceRefresh !== undefined && typeof value.forceRefresh !== 'boolean')
        || (value.automatic === true && value.forceRefresh === true)
        || !isRecord(value.source) || typeof value.source.url !== 'string' || typeof value.source.pageTitle !== 'string'
        || parseDiscordChannel(value.source.url)?.channelId !== channelId) {
        throw new AppError({ kind: 'invalid_request', message: '翻译请求缺少有效的消息正文或身份。' });
      }
      return { type: value.type, requestId, channelId, messageId, sourceText, settingsRevision,
        source: { url: value.source.url, pageTitle: value.source.pageTitle },
        ...(value.automatic ? { automatic: true } : {}), ...(value.forceRefresh ? { forceRefresh: true } : {}),
      };
    }
    default: throw new AppError({ kind: 'invalid_request', message: '未知的扩展操作。' });
  }
}

export function parseHistoryQuery(value: unknown): HistoryQuery {
  const invalid = () => new AppError({ kind: 'invalid_request', message: '记录查询条件或分页位置不正确。' });
  if (!isRecord(value)) throw invalid();
  const query: HistoryQuery = {};
  for (const name of ['guildId', 'channelId', 'model', 'query'] as const) {
    if (value[name] !== undefined) {
      if (typeof value[name] !== 'string') throw invalid();
      if (value[name]) query[name] = value[name];
    }
  }
  if ((query.guildId && !/^\d+$/.test(query.guildId)) || (query.channelId && (!query.guildId || !/^\d+$/.test(query.channelId)))) throw invalid();
  if (value.targetLanguage !== undefined && value.targetLanguage !== '') {
    if (!isLanguage(value.targetLanguage)) throw invalid();
    query.targetLanguage = value.targetLanguage;
  }
  if (value.cursor !== undefined) {
    const cursor = value.cursor;
    if (!isRecord(cursor) || !Number.isSafeInteger(cursor.upperSequence) || (cursor.upperSequence as number) < 0
      || !Array.isArray(cursor.before) || cursor.before.length !== 2
      || !cursor.before.every((part) => Number.isSafeInteger(part) && part >= 0)
      || cursor.before[1] === 0 || typeof cursor.filterKey !== 'string') throw invalid();
    query.cursor = { upperSequence: cursor.upperSequence as number, before: [cursor.before[0], cursor.before[1]], filterKey: cursor.filterKey };
  }
  return query;
}
