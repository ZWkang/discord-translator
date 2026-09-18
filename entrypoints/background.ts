import { browser } from 'wxt/browser';
import { createBackgroundService, senderRole } from '@/lib/background-service';
import { createSettingsRepository } from '@/lib/settings';
import { translateText } from '@/lib/openrouter';
import { AppError, publicSettings, type PublicSettings } from '@/lib/messages';

export default defineBackground(() => {
  const settings = createSettingsRepository(browser.storage.local);
  const popupUrl = browser.runtime.getURL('/popup.html');
  const subscribers = new Set<ReturnType<typeof browser.runtime.connect>>();
  const ready = browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  void ready.catch(() => console.error('[Discord Translator] 无法限制本地密钥存储的访问权限。'));
  const changed = (value: PublicSettings) => {
    for (const port of subscribers) port.postMessage({ type: 'settings.changed', settings: value });
  };
  const handle = createBackgroundService({
    extensionId: browser.runtime.id, popupUrl, ready: () => ready, settings,
    translate: translateText, changed,
    openSettings: async () => { await browser.tabs.create({ url: popupUrl }); },
  });
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handle(message, sender).then(sendResponse);
    return true;
  });
  browser.runtime.onConnect.addListener((port) => {
    try {
      if (port.name !== 'dt-settings' || !port.sender || senderRole(port.sender, browser.runtime.id, popupUrl) !== 'discord') {
        port.disconnect(); return;
      }
    } catch { port.disconnect(); return; }
    subscribers.add(port);
    port.onDisconnect.addListener(() => subscribers.delete(port));
    void ready.then(() => settings.get()).then((value) => {
      if (subscribers.has(port)) port.postMessage({ type: 'settings.changed', settings: publicSettings(value) });
    }).catch((error) => {
      if (subscribers.has(port)) port.postMessage({ type: 'settings.error', error: error instanceof AppError
        ? error.detail : { kind: 'settings_error', message: '无法读取扩展设置，请检查后台。' } });
    });
  });
});
