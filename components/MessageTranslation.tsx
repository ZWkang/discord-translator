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
export function TranslationAction(props: { state: Accessor<MessageState>; translate: (forceRefresh?: boolean) => void }) {
  let button!: HTMLButtonElement;
  let menu!: HTMLDivElement;
  let item!: HTMLButtonElement;
  const [expanded, setExpanded] = createSignal(false);
  const [position, setPosition] = createSignal({ left: '0px', top: '0px' });
  const refreshing = () => props.state().regeneration?.status === 'loading';
  const busy = () => props.state().status === 'loading' || refreshing();
  const label = () => refreshing() ? '重新翻译中…' : props.state().status === 'success'
    ? '已翻译'
    : ({ idle: '翻译', loading: '翻译中…', error: '重试' } as const)[props.state().status as 'idle' | 'loading' | 'error'];
  const accessibleLabel = () => props.state().status === 'success' && !refreshing()
    ? props.state().origin === 'memory' ? '已翻译，来自本地记录，未调用模型；打开翻译操作' : '消息已翻译；打开翻译操作'
    : refreshing() ? '正在重新翻译消息' : props.state().status === 'loading' ? '正在翻译消息' : props.state().status === 'error' ? '重试翻译消息' : '翻译消息';
  const close = (focus = true) => { menu.hidePopover(); setExpanded(false); if (focus) button.focus(); };
  const open = () => {
    if (busy()) return;
    const rect = button.getBoundingClientRect();
    menu.showPopover();
    setExpanded(true);
    const box = menu.getBoundingClientRect();
    setPosition({ left: `${Math.max(8, Math.min(rect.left, innerWidth - box.width - 8))}px`,
      top: `${Math.max(8, rect.bottom + box.height + 8 > innerHeight ? rect.top - box.height - 4 : rect.bottom + 4)}px` });
    item.focus();
  };
  return <>
    <button ref={button} type="button" class="dt-button dt-translate-button" data-state={busy() ? 'loading' : props.state().status}
      aria-disabled={busy()} aria-label={accessibleLabel()} title={accessibleLabel()}
      aria-haspopup={props.state().status === 'success' ? 'menu' : undefined} aria-expanded={props.state().status === 'success' ? expanded() : undefined}
      on:keydown={(event) => { isolateActivation(event); if (event.key === 'ArrowDown' && props.state().status === 'success') { event.preventDefault(); event.stopPropagation(); open(); } }}
      on:keyup={isolateActivation}
      on:click={(event) => { event.stopPropagation(); if (busy()) return; if (props.state().status === 'success') open(); else props.translate(); }}>
      <Show when={props.state().status === 'success' && !busy()} fallback={<span aria-hidden="true" classList={{ 'dt-spinner': busy() }}>{busy() ? '' : '译'}</span>}>
        <svg class="dt-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </Show>
      {label()}<Show when={props.state().status === 'success' && !busy()}>
        <svg class="dt-action-icon dt-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </Show>
    </button>
    <div ref={menu} popover="auto" role="menu" aria-label="翻译操作" class="dt-translation-menu" style={position()}
      on:toggle={(event) => setExpanded((event as ToggleEvent).newState === 'open')}
      on:keydown={(event) => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }}
      on:keyup={(event) => event.stopPropagation()}
      on:focusout={(event) => { if (event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) close(false); }}>
      <button ref={item} type="button" role="menuitem" class="dt-menu-item" on:click={(event) => { event.stopPropagation(); close(); props.translate(true); }}>重新翻译</button>
      <p>重新调用模型，可能产生费用。</p>
    </div>
  </>;
}
export function TranslationResult(props: { state: Accessor<MessageState>; openSettings: () => Promise<void> }) {
  const [actionError, setActionError] = createSignal('');
  const error = () => props.state().error;
  const persistenceError = () => { const value = props.state().persistence; return value?.status === 'not-saved' ? value.error.message : ''; };
  const canConfigure = () => ['missing_configuration', 'model_incompatible', 'authentication', 'configuration_changed', 'settings_error'].includes(error()?.kind ?? '');
  const open = async () => {
    setActionError('');
    try { await props.openSettings(); }
    catch (error) { setActionError(error instanceof AppError ? error.message : '无法打开扩展设置页。'); }
  };
  return <div class="dt-result-root" aria-live="polite" aria-busy={props.state().status === 'loading' || props.state().regeneration?.status === 'loading'}>
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
              <Show when={detail().storageCode}><p>存储错误：{detail().storageCode}</p></Show>
              <Show when={detail().status}><p>HTTP：{detail().status}</p></Show>
              <Show when={detail().code}><p>错误码：{detail().code}</p></Show>
              <Show when={detail().providerRequestId}><p>请求：{detail().providerRequestId}</p></Show>
            </details>
          </div>
        </>}</Show>
        <Show when={actionError()}><p role="alert">{actionError()}</p></Show>
      </section>
      <Show when={props.state().persistence?.status === 'not-saved'}>
        <details class="dt-persistence-warning"><summary>未保存</summary><p>{persistenceError()}</p></details>
      </Show>
      <Show when={props.state().regeneration?.status === 'error'}>
        <div class="dt-persistence-warning" role="alert">
          <p>重新翻译失败 · {props.state().regeneration?.error?.message}</p>
          <Show when={props.state().regeneration?.candidate}><details><summary>查看未保存的新译文</summary><p class="dt-translated-text">{props.state().regeneration?.candidate}</p></details></Show>
        </div>
      </Show>
    </Show>
  </div>;
}
