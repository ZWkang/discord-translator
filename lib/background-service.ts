import { AppError, isRecord, parseRequest, publicSettings, type PublicSettings, type Reply, type Settings } from './messages';
import type { createSettingsRepository } from './settings';
import { createTranslationService } from './translation-service';
import type { TranslationMemory } from './translation-memory';
import { discordMessageUrl, parseDiscordChannel } from './discord-route';
export interface Sender { id?: string; url?: string; frameId?: number; tab?: { url?: string } }
export function senderRole(sender: Sender, extensionId: string, popupUrl: string, historyUrl: string): 'popup' | 'discord' | 'history' {
  if (sender.id === extensionId && sender.url === popupUrl) return 'popup';
  if (sender.id === extensionId && sender.url === historyUrl) return 'history';
  if (sender.id === extensionId && sender.frameId === 0 && sender.url && /^https:\/\/discord\.com\//.test(sender.url)) return 'discord';
  throw new AppError({ kind: 'forbidden', message: '此页面无权调用该扩展操作。' });
}
export function createBackgroundService(deps: {
  extensionId: string; popupUrl: string; historyUrl: string; ready: () => Promise<void>;
  settings: ReturnType<typeof createSettingsRepository>;
  memory: TranslationMemory;
  translate: (settings: Settings, source: string) => Promise<string>;
  changed: (settings: PublicSettings) => void;
  openSettings: () => Promise<void>;
  openHistory: () => Promise<void>;
}) {
  const translate = createTranslationService(deps.memory, deps.translate);
  return async (input: unknown, sender: Sender): Promise<Reply<unknown> & { requestId?: string }> => {
    const requestId = isRecord(input) && typeof input.requestId === 'string' ? input.requestId : undefined;
    let operation = 'request';
    try {
      const role = senderRole(sender, deps.extensionId, deps.popupUrl, deps.historyUrl);
      const request = parseRequest(input);
      operation = request.type;
      if (['settings.get', 'settings.save', 'settings.clearKey', 'settings.setAutoTranslate'].includes(request.type) && role !== 'popup') {
        throw new AppError({ kind: 'forbidden', message: '密钥与设置只能在扩展设置页操作。' });
      }
      if (request.type === 'translation.request' && role !== 'discord') throw new AppError({ kind: 'forbidden', message: '请从 Discord 消息旁发起翻译。' });
      if (request.type.startsWith('history.') && role !== (request.type === 'history.open' ? 'popup' : 'history')) {
        throw new AppError({ kind: 'forbidden', message: '翻译记录只能在本扩展的记录页查看和管理。' });
      }
      if (request.type.startsWith('settings.') && role === 'history') throw new AppError({ kind: 'forbidden', message: '记录页不能读取或修改翻译设置。' });
      await deps.ready();
      switch (request.type) {
        case 'settings.get': return { ok: true, data: await deps.settings.get() };
        case 'settings.getPublic': return { ok: true, data: publicSettings(await deps.settings.get()) };
        case 'settings.save': case 'settings.clearKey': {
          const settings = request.type === 'settings.save' ? await deps.settings.save(request.settings) : await deps.settings.clearKey();
          deps.changed(publicSettings(settings));
          return { ok: true, data: settings };
        }
        case 'settings.setAutoTranslate': {
          const settings = await deps.settings.setAutoTranslate(request.enabled);
          deps.changed(publicSettings(settings));
          return { ok: true, data: settings };
        }
        case 'settings.open': await deps.openSettings(); return { ok: true, data: null };
        case 'history.open': await deps.openHistory(); return { ok: true, data: null };
        case 'history.list': return { ok: true, data: await deps.memory.list(request.query) };
        case 'history.filters': return { ok: true, data: await deps.memory.filters() };
        case 'history.get': return { ok: true, data: await deps.memory.get(request.entryId) };
        case 'history.delete': await deps.memory.remove(request.entryId); return { ok: true, data: null };
        case 'history.clear': await deps.memory.clear(); return { ok: true, data: null };
        case 'translation.request': {
          const location = parseDiscordChannel(request.source.url);
          // sender.url identifies the injected document and can retain its old
          // URL after Discord pushState. The native tab URL tracks SPA routing.
          const actual = sender.tab?.url && parseDiscordChannel(sender.tab.url);
          if (!location || !actual || location.guildId !== actual.guildId || location.channelId !== actual.channelId) {
            throw new AppError({ kind: 'invalid_request', message: '消息来源与当前 Discord 频道不一致，请刷新频道后重试。' });
          }
          const source = { ...location, messageId: request.messageId, pageTitle: request.source.pageTitle,
            sourceUrl: discordMessageUrl({ ...location, messageId: request.messageId }) };
          const settings = await deps.settings.get();
          if (request.automatic && !settings.autoTranslate) throw new AppError({ kind: 'auto_translation_disabled', message: '自动翻译已关闭。' });
          if (settings.revision !== request.settingsRevision) throw new AppError({ kind: 'configuration_changed', message: '设置已更新，请重新点击翻译。' });
          const result = await translate(settings, request.sourceText, source, request.forceRefresh);
          return { ok: true, requestId: request.requestId, data: {
            requestId: request.requestId, settingsRevision: settings.revision,
            targetLanguage: settings.targetLanguage, model: settings.model, ...result,
          } };
        }
      }
    } catch (error) {
      if (!(error instanceof AppError)) console.error('[Discord Translator] unexpected extension failure', error);
      const detail = error instanceof AppError ? error.detail : {
        kind: 'settings_error' as const, message: '扩展操作失败：无法访问本地设置或扩展页面，请检查后台。',
      };
      if (detail.kind !== 'auto_translation_disabled') console.error('[Discord Translator]', operation, detail.kind, detail.status ?? '');
      return { ok: false, requestId, error: detail };
    }
  };
}
