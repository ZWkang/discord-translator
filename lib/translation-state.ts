import { AppError, connectionError, type PublicSettings, type TranslationError, type TranslationReply, type TranslationRequest } from './messages';
import type { Persistence } from './history-types';

export interface MessageState {
  sourceText: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  requestId?: string;
  translatedText?: string;
  targetLanguage?: PublicSettings['targetLanguage'];
  error?: TranslationError;
  origin?: 'model' | 'memory';
  persistence?: Persistence;
  regeneration?: { status: 'loading' | 'error'; error?: TranslationError; candidate?: string };
}
export class TranslationState {
  private channelId = '';
  private epoch = 0;
  private settings: PublicSettings | null = null;
  private entries = new Map<string, MessageState>();
  private listeners = new Set<() => void>();
  constructor(private readonly bridge: {
    settings: () => Promise<PublicSettings>;
    source: () => TranslationRequest['source'];
    translate: (request: TranslationRequest) => Promise<TranslationReply>;
  }) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { for (const listener of this.listeners) listener(); }
  get(messageId: string) { return this.entries.get(messageId); }
  isAutomaticEnabled() { return this.settings?.autoTranslate === true; }
  channel(channelId: string) {
    if (this.channelId === channelId) return;
    this.channelId = channelId;
    this.epoch++;
    this.entries.clear();
    this.notify();
  }
  bind(messageId: string, sourceText: string): MessageState {
    const current = this.entries.get(messageId);
    if (current && current.sourceText === sourceText) return current;
    const value: MessageState = { sourceText, status: 'idle' };
    this.entries.set(messageId, value);
    this.notify();
    return value;
  }
  configure(settings: PublicSettings) {
    if (this.settings && this.settings.revision !== settings.revision) {
      for (const [id, state] of this.entries) this.entries.set(id, { sourceText: state.sourceText, status: 'idle' });
    }
    this.settings = settings;
    this.notify();
  }
  disconnected() {
    for (const [id, state] of this.entries) {
      if (state.status === 'loading') this.entries.set(id, { sourceText: state.sourceText, status: 'error', error: connectionError() });
      if (state.regeneration?.status === 'loading') this.entries.set(id, { ...state, requestId: undefined, regeneration: { status: 'error', error: connectionError() } });
    }
    this.notify();
  }
  async translate(messageId: string, sourceText: string, automatic = false, forceRefresh = false) {
    const current = this.bind(messageId, sourceText);
    if (automatic && (!this.isAutomaticEnabled() || current.status !== 'idle')) return;
    if (current.status === 'loading' || current.regeneration?.status === 'loading' || (current.status === 'success' && !forceRefresh) || !sourceText.trim()) return;
    const previous = forceRefresh && current.status === 'success' ? current : undefined;
    const source = this.bridge.source();
    const requestId = crypto.randomUUID();
    const epoch = this.epoch;
    const channelId = this.channelId;
    this.entries.set(messageId, previous ? { ...previous, requestId, regeneration: { status: 'loading' } } : { sourceText, status: 'loading', requestId });
    this.notify();
    const valid = () => this.epoch === epoch && this.entries.get(messageId)?.requestId === requestId;
    try {
      const settings = await this.bridge.settings();
      if (!valid()) return;
      // Keep mode updates from the settings subscription authoritative while
      // refreshing model/language credentials for this request.
      this.configure({ ...settings, autoTranslate: this.settings?.autoTranslate ?? settings.autoTranslate });
      if (!valid()) return;
      if (automatic && !this.isAutomaticEnabled()) {
        this.entries.set(messageId, { sourceText, status: 'idle' });
        this.notify();
        return;
      }
      const reply = await this.bridge.translate({ type: 'translation.request', requestId, channelId, messageId, sourceText, source,
        settingsRevision: settings.revision, ...(automatic ? { automatic: true } : {}), ...(forceRefresh ? { forceRefresh: true } : {}) });
      if (!valid()) return;
      if (reply.requestId !== requestId) throw new AppError({ kind: 'response', message: '翻译响应与当前请求不匹配。' });
      if (!reply.ok) {
        if (reply.error.kind === 'auto_translation_disabled') {
          this.entries.set(messageId, { sourceText, status: 'idle' });
          this.notify();
          return;
        }
        throw new AppError(reply.error);
      }
      if (reply.data.settingsRevision !== settings.revision) throw new AppError({ kind: 'configuration_changed', message: '设置已更新，请重新点击翻译。' });
      if (previous && reply.data.persistence.status === 'not-saved') {
        this.entries.set(messageId, { ...previous, requestId, regeneration: { status: 'error', error: reply.data.persistence.error, candidate: reply.data.translatedText } });
      } else {
        this.entries.set(messageId, { sourceText, status: 'success', translatedText: reply.data.translatedText,
          targetLanguage: reply.data.targetLanguage, origin: reply.data.origin, persistence: reply.data.persistence });
      }
    } catch (error) {
      if (!valid()) return;
      const detail = error instanceof AppError ? error.detail : connectionError();
      this.entries.set(messageId, previous ? { ...previous, requestId, regeneration: { status: 'error', error: detail } } : { sourceText, status: 'error', error: detail });
    }
    this.notify();
  }
}
