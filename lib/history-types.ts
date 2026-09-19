import type { TargetLanguage, TranslationError } from './messages';

export interface TranslationIdentity {
  siteOrigin: 'https://discord.com';
  provider: 'openrouter';
  model: string;
  targetLanguage: TargetLanguage;
  promptVersion: number;
  sourceText: string;
}
export interface TranslationKey extends TranslationIdentity { id: string }
export interface HistoryEntry extends TranslationKey {
  translatedText: string;
  createdAt: number;
  createdSequence: number;
  updatedAt: number;
  lastUsedAt: number;
}
export interface MessageSource {
  guildId: string;
  channelId: string;
  messageId: string;
  pageTitle: string;
  sourceUrl: string;
}
export interface HistorySource extends MessageSource {
  entryId: string;
  firstSeenAt: number;
  lastSeenAt: number;
}
export interface HistoryDetail { entry: HistoryEntry; sources: HistorySource[] }
export interface HistoryFilter {
  guildId?: string;
  channelId?: string;
  targetLanguage?: TargetLanguage;
  model?: string;
  query?: string;
}
export interface HistoryCursor {
  upperSequence: number;
  before: [number, number];
  filterKey: string;
}
export interface HistoryQuery extends HistoryFilter { cursor?: HistoryCursor }
export interface HistoryPage { items: HistoryEntry[]; nextCursor: HistoryCursor | null }
export interface HistoryFilters {
  guildIds: string[];
  channels: { guildId: string; channelId: string; pageTitle: string }[];
  models: string[];
  targetLanguages: TargetLanguage[];
}
export type Persistence = { status: 'saved' } | { status: 'not-saved'; error: TranslationError };
export interface MemoryResult {
  entryId: string;
  translatedText: string;
  origin: 'model' | 'memory';
  persistence: Persistence;
}
export interface DeletionStamp { collection: number; entry: number }

export function historyFilterKey(filter: HistoryFilter): string {
  return JSON.stringify([filter.guildId ?? '', filter.channelId ?? '', filter.targetLanguage ?? '', filter.model ?? '', filter.query ?? '']);
}
