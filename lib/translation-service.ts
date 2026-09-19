import { AppError, type Settings } from './messages';
import type { DeletionStamp, MemoryResult, MessageSource, TranslationKey } from './history-types';
import { historyFailure, type TranslationMemory } from './translation-memory';
import { createTranslationKey } from './translation-key';
import { translationPromptVersion } from './openrouter';

type WorkResult = { result: MemoryResult; owner: MessageSource };
type Slot = { normal?: Promise<WorkResult>; refresh?: Promise<WorkResult> };

export function createTranslationService(memory: TranslationMemory, translate: (settings: Settings, text: string) => Promise<string>) {
  const jobs = new Map<string, Slot>();
  function credentials(settings: Settings) {
    if (!settings.apiKey || !settings.model) throw new AppError({ kind: 'missing_configuration', message: '请先填写 OpenRouter API Key 和模型 ID。' });
  }
  async function hit(key: TranslationKey, text: string, source: MessageSource, stamp: DeletionStamp): Promise<MemoryResult> {
    try {
      const entry = await memory.associate(key, source, stamp);
      return { entryId: key.id, translatedText: entry.translatedText, origin: 'memory', persistence: { status: 'saved' } };
    } catch (error) {
      const failure = historyFailure(error, 'write');
      if (failure.detail.kind === 'history_deleted') throw failure;
      return { entryId: key.id, translatedText: text, origin: 'memory', persistence: { status: 'not-saved',
        error: { ...failure.detail, message: `译文已读取，但此次来源未保存。${failure.message}` } } };
    }
  }
  async function generate(key: TranslationKey, settings: Settings, source: MessageSource, stamp: DeletionStamp, replace: boolean): Promise<WorkResult> {
    const current = await memory.lookup(key, stamp);
    if (!replace && current) return { owner: source, result: await hit(key, current.translatedText, source, stamp) };
    credentials(settings);
    const translatedText = await translate(settings, key.sourceText);
    if (!translatedText.trim()) throw new AppError({ kind: 'response', message: '模型未返回完整译文。' });
    try {
      const entry = await memory.save(key, translatedText, source, stamp, replace);
      return { owner: source, result: { entryId: key.id, translatedText: entry.translatedText, origin: 'model', persistence: { status: 'saved' } } };
    } catch (error) {
      return { owner: source, result: { entryId: key.id, translatedText, origin: 'model',
        persistence: { status: 'not-saved', error: historyFailure(error, 'write').detail } } };
    }
  }
  return async (settings: Settings, text: string, source: MessageSource, forceRefresh = false): Promise<MemoryResult> => {
    const key = await createTranslationKey({ siteOrigin: 'https://discord.com', provider: 'openrouter',
      model: settings.model, targetLanguage: settings.targetLanguage, promptVersion: translationPromptVersion, sourceText: text });
    const inspected = await memory.inspect(key);
    if (!forceRefresh && inspected.entry) return hit(key, inspected.entry.translatedText, source, inspected.stamp);
    if (forceRefresh) credentials(settings);
    const group = `${key.id}:${inspected.stamp.collection}:${inspected.stamp.entry}`;
    let slot = jobs.get(group);
    if (!slot) { slot = {}; jobs.set(group, slot); }
    const kind = forceRefresh ? 'refresh' : slot.refresh ? 'refresh' : 'normal';
    let work = slot[kind];
    if (!work) {
      const predecessor = forceRefresh ? slot.normal : undefined;
      // Register synchronously before any async work. Keep the job until its
      // first record+source transaction settles, not merely until fetch ends.
      work = Promise.resolve().then(async () => {
        if (predecessor) {
          // This is an independently requested regeneration. Waiting for an
          // older failed operation must not turn it into an automatic retry.
          await predecessor.then(() => undefined, () => undefined);
        }
        return generate(key, settings, source, inspected.stamp, forceRefresh);
      });
      slot[kind] = work;
      const captured = slot;
      const cleanup = () => {
        if (captured[kind] === work) delete captured[kind];
        if (!captured.normal && !captured.refresh && jobs.get(group) === captured) jobs.delete(group);
      };
      void work.then(cleanup, cleanup);
    }
    const completed = await work;
    if (completed.owner === source || completed.result.persistence.status === 'not-saved') return completed.result;
    try {
      const entry = await memory.associate(key, source, inspected.stamp);
      return { ...completed.result, translatedText: entry.translatedText };
    } catch (error) {
      return { ...completed.result, persistence: { status: 'not-saved', error: historyFailure(error, 'write').detail } };
    }
  };
}
