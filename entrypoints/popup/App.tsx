import { createSignal, onMount, Show, For } from 'solid-js';
import { browser } from 'wxt/browser';
import { AppError, languages, type Settings, type TargetLanguage } from '@/lib/messages';
import { rpc } from '@/lib/rpc';
import logo from '@/assets/branding/discord-translator-line-v1.png';
import './App.css';

export default function App() {
  const version = browser.runtime.getManifest().version;
  const [apiKey, setApiKey] = createSignal('');
  const [model, setModel] = createSignal('');
  const [language, setLanguage] = createSignal<TargetLanguage>('zh-CN');
  const [autoTranslate, setAutoTranslate] = createSignal(false);
  const [visible, setVisible] = createSignal(false);
  const [busy, setBusy] = createSignal(true);
  const [savedKey, setSavedKey] = createSignal(false);
  const [attempted, setAttempted] = createSignal(false);
  const [feedback, setFeedback] = createSignal<{ message: string; error: boolean }>();
  const applySettings = (settings: Settings) => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setLanguage(settings.targetLanguage);
    setAutoTranslate(settings.autoTranslate);
    setSavedKey(Boolean(settings.apiKey));
  };
  const showError = (error: unknown) => {
    setFeedback({ error: true, message: error instanceof AppError ? error.message : '设置操作失败，请检查扩展后台。' });
    if (!(error instanceof AppError)) console.error('[Discord Translator] settings UI failure', error);
  };
  onMount(async () => {
    try { applySettings(await rpc<Settings>({ type: 'settings.get' })); }
    catch (error) { showError(error); }
    finally { setBusy(false); }
  });
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    if (busy()) return;
    setAttempted(true);
    setFeedback(undefined);
    if (!apiKey().trim() || !model().trim()) return;
    setBusy(true);
    try {
      applySettings(await rpc<Settings>({ type: 'settings.save', settings: { apiKey: apiKey(), model: model(), targetLanguage: language(), autoTranslate: autoTranslate() } }));
      setVisible(false);
      setAttempted(false);
      setFeedback({ error: false, message: '已保存。模型可用性将在翻译时验证。' });
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };
  const clearKey = async () => {
    setBusy(true);
    setFeedback(undefined);
    try {
      applySettings(await rpc<Settings>({ type: 'settings.clearKey' }));
      setVisible(false);
      setAttempted(false);
      setFeedback({ error: false, message: 'API Key 已清除，自动翻译已关闭。模型与语言已保留。' });
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };
  const toggleAutoTranslate = async () => {
    if (busy()) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const settings = await rpc<Settings>({ type: 'settings.setAutoTranslate', enabled: !autoTranslate() });
      setAutoTranslate(settings.autoTranslate);
      setFeedback({ error: false, message: settings.autoTranslate ? '已开启自动翻译。' : '已关闭自动翻译，正在处理的请求会继续完成。' });
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };
  const openHistory = async () => {
    try { await rpc<void>({ type: 'history.open' }); }
    catch (error) { showError(error); }
  };
  return (
    <main class="dt-settings">
      <header class="dt-heading">
        <div class="dt-mark" aria-hidden="true"><img src={logo} alt="" width="32" height="32" /></div>
        <span class="dt-version">v{version}</span>
        <h1>Discord 翻译</h1>
        <p>按需点击，或开启自动翻译。</p>
      </header>
      <section class="dt-auto-setting">
        <div><label id="auto-label" for="auto-translate">自动翻译</label><p class="dt-hint" id="auto-help">按已保存设置翻译已加载及新出现的频道消息。开关即时保存，可能增加调用费用。</p></div>
        <button id="auto-translate" class="dt-switch" type="button" role="switch" aria-checked={autoTranslate()}
          aria-labelledby="auto-label" aria-describedby="auto-help" disabled={busy()} onClick={toggleAutoTranslate}>
          <span aria-hidden="true" />
        </button>
      </section>
      <form class="dt-form" onSubmit={save} noValidate aria-busy={busy()}>
        <h2>OpenRouter <span>模型接入</span></h2>
        <div class="dt-field">
          <label for="api-key">API Key</label>
          <div class="dt-key-row">
            <input class="dt-input" id="api-key" type={visible() ? 'text' : 'password'} autocomplete="off" spellcheck={false}
              placeholder="填入你的 API Key" value={apiKey()} disabled={busy()}
              aria-invalid={attempted() && !apiKey().trim()} aria-describedby={attempted() && !apiKey().trim() ? 'key-error' : undefined}
              onInput={(event) => { setApiKey(event.currentTarget.value); setFeedback(undefined); }} />
            <button class="dt-button dt-reveal" type="button" aria-label={visible() ? '隐藏 API Key' : '显示 API Key'} aria-pressed={visible()} onClick={() => setVisible(!visible())}>{visible() ? '隐藏' : '显示'}</button>
          </div>
          <Show when={attempted() && !apiKey().trim()}><p id="key-error" class="dt-field-error">请填写 API Key</p></Show>
        </div>
        <div class="dt-field">
          <label for="model">模型 ID</label>
          <input class="dt-input" id="model" placeholder="provider/model-name" value={model()} disabled={busy()} spellcheck={false}
            aria-invalid={attempted() && !model().trim()} aria-describedby={attempted() && !model().trim() ? 'model-help model-error' : 'model-help'}
            onInput={(event) => { setModel(event.currentTarget.value); setFeedback(undefined); }} />
          <p id="model-help" class="dt-hint">填写支持文本生成的 OpenRouter 模型 ID。</p>
          <Show when={attempted() && !model().trim()}><p id="model-error" class="dt-field-error">请填写模型 ID</p></Show>
        </div>
        <div class="dt-field">
          <label for="language">翻译成</label>
          <select class="dt-input" id="language" value={language()} disabled={busy()} onChange={(event) => { setLanguage(event.currentTarget.value as TargetLanguage); setFeedback(undefined); }}>
            <For each={Object.entries(languages)}>{([value, label]) => <option value={value}>{label}</option>}</For>
          </select>
        </div>
        <button type="submit" class="dt-button dt-save" disabled={busy()}>{busy() ? '处理中…' : '保存设置'}<span aria-hidden="true">✓</span></button>
      </form>
      <div class="dt-feedback-slot" aria-live="polite">
        <Show when={feedback()}>{(value) => <p class="dt-feedback" classList={{ 'dt-feedback-error': value().error }}>{value().message}</p>}</Show>
      </div>
      <button class="dt-link-button dt-clear" type="button" disabled={busy() || !savedKey()} onClick={clearKey}>清除 API Key</button>
      <button class="dt-link-button dt-history-open" type="button" onClick={() => void openHistory()}>翻译记录 ↗</button>
      <footer class="dt-privacy"><strong>{autoTranslate() ? '自动翻译已开启，可随时关闭。' : '手动模式只翻译你点选的消息。'}</strong><p>普通翻译优先复用本地记录。未命中或选择「重新翻译」时，消息正文会发送给 OpenRouter 及模型提供方，可能产生费用。</p><p>原文、译文和消息来源仅保存在此浏览器，可在翻译记录页查看和删除。清除密钥不会清空记录，也不会主动抓取频道历史。</p></footer>
    </main>
  );
}
