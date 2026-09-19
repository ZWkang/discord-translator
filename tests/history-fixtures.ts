import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createTranslationMemory } from '@/lib/translation-memory';
import { createTranslationKey } from '@/lib/translation-key';
import { discordMessageUrl } from '@/lib/discord-route';
import type { MessageSource, TranslationIdentity } from '@/lib/history-types';
import type { Settings } from '@/lib/messages';

export const settings: Settings = { apiKey: 'not-a-real-key', model: 'provider/test', targetLanguage: 'zh-CN', revision: 's1', autoTranslate: false };
export const identity: TranslationIdentity = { siteOrigin: 'https://discord.com', provider: 'openrouter', model: settings.model, targetLanguage: 'zh-CN', promptVersion: 1, sourceText: 'Hello\nworld' };
export const makeKey = (changes: Partial<TranslationIdentity> = {}) => createTranslationKey({ ...identity, ...changes });
export function makeSource(channelId = '20', messageId = '30', guildId = '10'): MessageSource {
  return { guildId, channelId, messageId, pageTitle: `#test-${channelId} | Discord`, sourceUrl: discordMessageUrl({ guildId, channelId, messageId }) };
}
export function makeMemory(now: () => number = Date.now) {
  const factory = new IDBFactory();
  const name = crypto.randomUUID();
  return { factory, name, memory: createTranslationMemory({ name, factory, now }) };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
