import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { channelFromUrl, readMessage, type DiscordMessage } from '@/lib/discord-dom';
import { observeMessages } from '@/lib/discord-observer';
import { TranslationState } from '@/lib/translation-state';
import { AppError, connectionError, type PublicSettings, type TranslationReply } from '@/lib/messages';
import { rpc } from '@/lib/rpc';
import { messageAccessor, TranslationAction, TranslationResult } from '@/components/MessageTranslation';
import '@/assets/styles/translation.css';

export default defineContentScript({
  matches: ['https://discord.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    const store = new TranslationState({
      settings: () => rpc<PublicSettings>({ type: 'settings.getPublic' }),
      source: () => ({ url: currentUrl, pageTitle: document.title }),
      translate: async (request) => {
        try {
          const reply: TranslationReply = await browser.runtime.sendMessage(request);
          if (!reply) throw new AppError(connectionError());
          // A response can beat the observer's next frame after a Discord edit.
          const view = mounted.get(request.messageId);
          if (view?.row.isConnected) {
            const latest = readMessage(view.row, request.channelId);
            store.bind(request.messageId, latest?.sourceText ?? '');
          }
          return reply;
        } catch (error) {
          if (error instanceof AppError) throw error;
          throw new AppError(connectionError());
        }
      },
    });
    type Ui = Awaited<ReturnType<typeof createShadowRootUi<() => void>>>;
    interface Mounted { row: HTMLElement; body: HTMLElement; active: boolean; ready: boolean; action?: Ui; result?: Ui }
    const mounted = new Map<string, Mounted>();
    let stopObserver: (() => void) | undefined;
    let currentChannel: string | null = null;
    let currentUrl = location.href;
    let port: ReturnType<typeof browser.runtime.connect> | undefined;
    let stopped = false;
    const autoTranslate = (message: DiscordMessage) => {
      if (store.isAutomaticEnabled() && message.sourceText && store.get(message.messageId)?.status === 'idle') {
        void store.translate(message.messageId, message.sourceText, true);
      }
    };
    const unmount = (messageId: string) => {
      const existing = mounted.get(messageId);
      if (!existing) return;
      existing.active = false;
      existing.action?.remove();
      existing.result?.remove();
      mounted.delete(messageId);
    };
    const mount = async (message: DiscordMessage) => {
      store.bind(message.messageId, message.sourceText);
      if (!message.sourceText) { unmount(message.messageId); return; }
      const existing = mounted.get(message.messageId);
      if (existing?.body === message.body && existing.active
        && (!existing.ready || (existing.action?.shadowHost.isConnected && existing.result?.shadowHost.isConnected))) {
        if (existing.ready) autoTranslate(message);
        return;
      }
      unmount(message.messageId);
      const entry: Mounted = { row: message.row, body: message.body, active: true, ready: false };
      mounted.set(message.messageId, entry);
      const isCurrent = () => entry.active && message.body.isConnected && currentChannel === message.channelId && ctx.isValid;
      try {
        const action = await createShadowRootUi(ctx, {
          name: 'dt-translate-action', position: 'inline', anchor: message.body, append: 'last',
          // WXT's important :host reset outranks styles set outside the shadow.
          css: ':host { display: inline-block !important; margin-left: var(--dt-space-2) !important; vertical-align: middle !important; }',
          onMount: (container) => {
            return render(() => createComponent(TranslationAction, {
              state: messageAccessor(store, message.messageId),
              translate: (forceRefresh = false) => {
                const latest = readMessage(message.row, message.channelId);
                if (!latest || !latest.sourceText) return;
                void store.translate(latest.messageId, latest.sourceText, false, forceRefresh);
              },
            }), container);
          },
          onRemove: (dispose) => dispose?.(),
        });
        entry.action = action;
        const result = await createShadowRootUi(ctx, {
          name: 'dt-translate-result', position: 'inline', anchor: message.body, append: 'after',
          css: ':host { display: block !important; max-width: 100% !important; }',
          onMount: (container) => {
            return render(() => createComponent(TranslationResult, {
              state: messageAccessor(store, message.messageId),
              openSettings: () => rpc<void>({ type: 'settings.open' }),
            }), container);
          },
          onRemove: (dispose) => dispose?.(),
        });
        entry.result = result;
        if (!isCurrent()) { action.remove(); result.remove(); return; }
        action.mount();
        result.mount();
        entry.ready = true;
        autoTranslate(message);
      } catch (error) {
        if (mounted.get(message.messageId) === entry) unmount(message.messageId);
        console.error('[Discord Translator] message UI mounting failed', { messageId: message.messageId, error });
      }
    };
    const navigate = (url: string) => {
      currentUrl = url;
      const channelId = channelFromUrl(url);
      if (channelId === currentChannel) return;
      stopObserver?.();
      currentChannel = channelId;
      store.channel(channelId ?? '');
      stopObserver = channelId ? observeMessages(channelId, { update: (message) => { void mount(message); }, remove: unmount }) : undefined;
    };
    const connect = () => {
      if (stopped || ctx.isInvalid || port) return;
      try {
        const next = browser.runtime.connect({ name: 'dt-settings' });
        port = next;
        next.onMessage.addListener((message) => {
          if (message.type === 'settings.changed') {
            store.configure(message.settings);
            for (const entry of mounted.values()) {
              if (!entry.ready || !entry.active || !entry.row.isConnected || !currentChannel) continue;
              const latest = readMessage(entry.row, currentChannel);
              if (latest) { store.bind(latest.messageId, latest.sourceText); autoTranslate(latest); }
            }
          }
          if (message.type === 'settings.error') console.error('[Discord Translator]', message.error);
        });
        next.onDisconnect.addListener(() => {
          if (port !== next) return;
          port = undefined;
          store.disconnected();
          // Restore notifications after an MV3 worker restart, never a translation request.
          if (!stopped && ctx.isValid && !browser.runtime.lastError) connect();
          else if (!stopped) console.error('[Discord Translator] settings connection closed; refresh Discord to reconnect.');
        });
      } catch (error) {
        store.disconnected();
        console.error('[Discord Translator] cannot connect to extension background', error);
      }
    };
    // Navigation API events arrive before location.href changes.
    ctx.addEventListener(window, 'wxt:locationchange', (event) => navigate(event.newUrl.href));
    ctx.addEventListener(window, 'focus', connect);
    ctx.onInvalidated(() => {
      stopped = true;
      stopObserver?.();
      for (const id of mounted.keys()) unmount(id);
      port?.disconnect();
    });
    connect();
    navigate(location.href);
  },
});
