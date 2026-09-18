import { createSignal, onCleanup, Show, type Accessor } from 'solid-js';
import { AppError, languages } from '@/lib/messages';
import type { MessageState, TranslationState } from '@/lib/translation-state';

const languageLabels = { 'zh-CN': '简中', en: 'EN', ja: '日', ko: '韩' } as const;

export function messageAccessor(store: TranslationState, messageId: string): Accessor<MessageState> {
  const initial = store.get(messageId);
  if (!initial) throw new Error('Message must be bound before mounting its UI');
  const [state, setState] = createSignal(initial);
  onCleanup(store.subscribe(() => {
    const value = store.get(messageId);
    if (value) setState(value);
  }));
  return state;
}
function isolateActivation(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
}
export function TranslationAction(props: { state: Accessor<MessageState>; translate: () => void }) {
  const label = () => ({ idle: '翻译', loading: '翻译中…', success: '已翻译', error: '重试' })[props.state().status];
  const accessibleLabel = () => ({ idle: '翻译消息', loading: '正在翻译消息', success: '消息已翻译', error: '重试翻译消息' })[props.state().status];
  const unavailable = () => ['loading', 'success'].includes(props.state().status);
  return <button type="button" class="dt-button dt-translate-button" data-state={props.state().status}
    aria-disabled={unavailable()} aria-label={accessibleLabel()} on:keydown={isolateActivation} on:keyup={isolateActivation}
    on:click={(event) => { event.stopPropagation(); if (!unavailable()) props.translate(); }}>
    <span aria-hidden="true" classList={{ 'dt-spinner': props.state().status === 'loading' }}>{props.state().status === 'loading' ? '' : props.state().status === 'success' ? '✓' : '译'}</span>
    {label()}
  </button>;
}
export function TranslationResult(props: { state: Accessor<MessageState>; openSettings: () => Promise<void> }) {
  const [actionError, setActionError] = createSignal('');
  const error = () => props.state().error;
  const canConfigure = () => ['missing_configuration', 'model_incompatible', 'authentication', 'configuration_changed', 'settings_error'].includes(error()?.kind ?? '');
  const open = async () => {
    setActionError('');
    try { await props.openSettings(); }
    catch (error) { setActionError(error instanceof AppError ? error.message : '无法打开扩展设置页。'); }
  };
  return <div class="dt-result-root" aria-live="polite" aria-busy={props.state().status === 'loading'}>
    <Show when={props.state().status !== 'idle'}>
      <section class="dt-result" data-state={props.state().status}>
        <Show when={props.state().status === 'loading'}><div class="dt-loading"><span class="dt-spinner" aria-hidden="true" />翻译中…</div></Show>
        <Show when={props.state().status === 'success'}>
          <abbr class="dt-language" title={languages[props.state().targetLanguage!]}>{languageLabels[props.state().targetLanguage!]}</abbr>
          <p class="dt-translated-text" dir="auto">{props.state().translatedText}</p>
        </Show>
        <Show when={error()}>{(detail) => <>
          <p class="dt-error-text"><strong>翻译失败</strong> · {detail().message}</p>
          <Show when={detail().retryAfterSeconds}><p>上游建议等待 {detail().retryAfterSeconds} 秒后重试。</p></Show>
          <div class="dt-error-actions">
            <Show when={canConfigure()}><button type="button" class="dt-link-button" on:keydown={isolateActivation} on:keyup={isolateActivation} on:click={(event) => { event.stopPropagation(); void open(); }}>打开设置</button></Show>
            <details class="dt-details"><summary on:keydown={isolateActivation} on:keyup={isolateActivation} on:click={(event) => event.stopPropagation()}>错误详情</summary>
              <p>类型：{detail().kind}</p>
              <Show when={detail().status}><p>HTTP：{detail().status}</p></Show>
              <Show when={detail().code}><p>错误码：{detail().code}</p></Show>
              <Show when={detail().providerRequestId}><p>请求：{detail().providerRequestId}</p></Show>
            </details>
          </div>
        </>}</Show>
        <Show when={actionError()}><p role="alert">{actionError()}</p></Show>
      </section>
    </Show>
  </div>;
}
