import { createSignal, For, onMount, Show } from 'solid-js';
import { AppError, languages } from '@/lib/messages';
import type { HistoryCursor, HistoryDetail, HistoryEntry, HistoryFilter, HistoryFilters, HistoryPage } from '@/lib/history-types';
import { rpc } from '@/lib/rpc';
import logo from '@/assets/branding/discord-translator-line-v1.png';

const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN');
const errorText = (error: unknown) => error instanceof AppError ? error.message : '记录操作失败，请重试或检查扩展后台。';

export default function App() {
  const [filter, setFilter] = createSignal<HistoryFilter>({});
  const [query, setQuery] = createSignal('');
  const [options, setOptions] = createSignal<HistoryFilters>();
  const [entries, setEntries] = createSignal<HistoryEntry[]>([]);
  const [cursor, setCursor] = createSignal<HistoryCursor | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal('');
  const [detailId, setDetailId] = createSignal<string>();
  const [detail, setDetail] = createSignal<HistoryDetail>();
  const [detailError, setDetailError] = createSignal('');
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [deletion, setDeletion] = createSignal<{ id?: string; trigger: HTMLButtonElement }>();
  const [deleting, setDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal('');
  let queryVersion = 0;
  let detailVersion = 0;
  let dialog!: HTMLDialogElement;
  let refreshButton!: HTMLButtonElement;

  const channels = () => options()?.channels.filter(channel => !filter().guildId || channel.guildId === filter().guildId) ?? [];
  const filtered = () => Object.values(filter()).some(Boolean);
  const closeDetails = () => { detailVersion++; setDetailId(undefined); setDetail(undefined); setDetailError(''); setDetailLoading(false); };
  async function load(append = false) {
    if (append && (loading() || !cursor())) return;
    const version = ++queryVersion;
    const criteria = { ...filter(), ...(append && cursor() ? { cursor: cursor()! } : {}) };
    setLoading(true); setError('');
    if (!append) { setLoaded(false); setEntries([]); setCursor(null); closeDetails(); }
    try {
      const [page, choices] = await Promise.all([
        rpc<HistoryPage>({ type: 'history.list', query: criteria }),
        append ? Promise.resolve(options()) : rpc<HistoryFilters>({ type: 'history.filters' }),
      ]);
      if (version !== queryVersion) return;
      setEntries(previous => append ? [...new Map([...previous, ...page.items].map(entry => [entry.id, entry])).values()] : page.items);
      setCursor(page.nextCursor); if (choices) setOptions(choices); setLoaded(true);
    } catch (failure) { if (version === queryVersion) setError(errorText(failure)); }
    finally { if (version === queryVersion) setLoading(false); }
  }
  function changeFilter(changes: Partial<HistoryFilter>) {
    setFilter(previous => ({ ...previous, ...changes }));
    void load();
  }
  async function inspect(id: string) {
    const version = ++detailVersion;
    setDetailId(id); setDetail(undefined); setDetailError(''); setDetailLoading(true);
    try {
      const value = await rpc<HistoryDetail>({ type: 'history.get', entryId: id });
      if (version === detailVersion) setDetail(value);
    } catch (failure) { if (version === detailVersion) setDetailError(errorText(failure)); }
    finally { if (version === detailVersion) setDetailLoading(false); }
  }
  function askDelete(trigger: HTMLButtonElement, id?: string) {
    setDeletion({ id, trigger }); setDeleteError(''); dialog.showModal();
  }
  function cancelDelete() {
    const target = deletion()?.trigger;
    dialog.close(); setDeletion(undefined); setDeleteError(''); target?.focus();
  }
  async function confirmDelete() {
    const pending = deletion();
    if (!pending || deleting()) return;
    setDeleting(true); setDeleteError('');
    try {
      await rpc<void>(pending.id ? { type: 'history.delete', entryId: pending.id } : { type: 'history.clear' });
      dialog.close(); setDeletion(undefined);
      await load();
      if (pending.trigger.isConnected) pending.trigger.focus(); else refreshButton.focus();
    } catch (failure) { setDeleteError(errorText(failure)); }
    finally { setDeleting(false); }
  }
  onMount(() => { void load(); });

  return <main class="history-shell">
    <header class="history-heading">
      <div class="history-brand"><img src={logo} alt="" width="44" height="44" /><span>DISCORD TRANSLATOR</span></div>
      <div class="history-title-row"><div><p class="history-eyebrow">保留译文，再读一次。</p><h1>翻译记录<span aria-hidden="true">↙</span></h1></div>
        <div class="history-header-actions"><button ref={refreshButton} type="button" class="dt-button" onClick={() => void load()}>刷新记录</button>
          <button type="button" class="dt-link-button" onClick={event => askDelete(event.currentTarget)}>清空全部记录</button></div>
      </div>
      <p class="history-intro">仅保存在此浏览器。普通翻译优先复用记录，未命中才调用模型。</p>
    </header>
    <section class="history-filters" aria-label="筛选翻译记录">
      <form class="history-search" onSubmit={event => { event.preventDefault(); changeFilter({ query: query().trim() || undefined }); }}>
        <label for="history-search">查找原文或译文</label>
        <div><input id="history-search" type="search" placeholder="输入你想找的一句话…" value={query()} onInput={event => setQuery(event.currentTarget.value)} />
          <button type="submit" class="dt-button">搜索</button></div>
      </form>
      <div class="history-filter-grid">
        <label>服务器<select aria-label="服务器" onChange={event => changeFilter({ guildId: event.currentTarget.value || undefined, channelId: undefined })}>
          <option value="" selected={!filter().guildId}>全部服务器</option><For each={options()?.guildIds}>{id => <option value={id} selected={filter().guildId === id}>服务器 {id}</option>}</For>
          <Show when={filter().guildId && !options()?.guildIds.includes(filter().guildId!)}><option value={filter().guildId} selected>服务器 {filter().guildId}（暂无记录）</option></Show>
        </select></label>
        <label>频道<select aria-label="频道" disabled={!filter().guildId} onChange={event => changeFilter({ channelId: event.currentTarget.value || undefined })}>
          <option value="" selected={!filter().channelId}>{filter().guildId ? '全部频道' : '先选择服务器'}</option><For each={channels()}>{channel => <option value={channel.channelId} selected={filter().channelId === channel.channelId}>{channel.pageTitle || '频道'} · {channel.channelId}</option>}</For>
          <Show when={filter().channelId && !channels().some(channel => channel.channelId === filter().channelId)}><option value={filter().channelId} selected>频道 {filter().channelId}（暂无记录）</option></Show>
        </select></label>
        <label>翻译语言<select aria-label="翻译语言" onChange={event => changeFilter({ targetLanguage: event.currentTarget.value as HistoryFilter['targetLanguage'] || undefined })}>
          <option value="" selected={!filter().targetLanguage}>全部语言</option><For each={Object.entries(languages)}>{([value, label]) => <option value={value} selected={filter().targetLanguage === value}>{label}</option>}</For>
        </select></label>
        <label>模型<select aria-label="模型" onChange={event => changeFilter({ model: event.currentTarget.value || undefined })}>
          <option value="" selected={!filter().model}>全部模型</option><For each={options()?.models}>{model => <option value={model} selected={filter().model === model}>{model}</option>}</For>
          <Show when={filter().model && !options()?.models.includes(filter().model!)}><option value={filter().model} selected>{filter().model}（暂无记录）</option></Show>
        </select></label>
      </div>
      <Show when={filtered()}><button class="dt-link-button" type="button" onClick={() => { setQuery(''); setFilter({}); void load(); }}>清除筛选</button></Show>
    </section>
    <section class="history-records" aria-label="翻译记录列表" aria-busy={loading()}>
      <div class="history-list-heading"><h2>{filtered() ? '查找结果' : '全部记录'}</h2><span>首次生成时间 ↓ <Show when={loaded()}>· 已加载 {entries().length} 条</Show></span></div>
      <Show when={error()}><div class="history-notice history-error" role="alert"><p>{error()}</p><button type="button" class="dt-button" onClick={() => void load()}>重新加载</button></div></Show>
      <Show when={loading()}><p class="history-notice" role="status">正在读取记录…</p></Show>
      <Show when={loaded() && !loading() && !error() && entries().length === 0}>
        <div class="history-empty"><span aria-hidden="true">↗</span><h3>{filtered() ? '没有匹配的记录' : '第一条译文，从频道开始。'}</h3><p>{filtered() ? '换个词组，或清除筛选再看看。' : '在 Discord 翻译一条消息，成功保存后就会出现在这里。'}</p></div>
      </Show>
      <For each={entries()}>{record => <article class="history-entry" data-entry-id={record.id}>
        <div class="history-entry-meta"><span>{languages[record.targetLanguage]} · {record.model}</span><time dateTime={new Date(record.createdAt).toISOString()}>{formatTime(record.createdAt)}</time>
          <button type="button" class="dt-link-button" aria-label="删除词条" onClick={event => askDelete(event.currentTarget, record.id)}>删除</button></div>
        <button type="button" class="history-entry-toggle" aria-label={detailId() === record.id ? '收起词条详情' : '查看词条详情'} aria-expanded={detailId() === record.id}
          onClick={() => { if (detailId() === record.id) closeDetails(); else void inspect(record.id); }}>
          <div class="history-pair"><div><span class="history-text-label">原文</span><p class="history-preview" dir="auto">{record.sourceText}</p></div>
            <div><span class="history-text-label">{languages[record.targetLanguage]}</span><p class="history-preview" dir="auto">{record.translatedText}</p></div></div>
          <span class="history-expand-label">{detailId() === record.id ? '收起 ↑' : '完整内容与来源 ↗'}</span>
        </button>
        <Show when={detailId() === record.id}>
          <div class="history-detail" aria-label="词条详情" aria-busy={detailLoading()}>
            <Show when={detailLoading()}><p role="status">正在读取详情…</p></Show>
            <Show when={detailError()}><p role="alert">{detailError()}</p><button type="button" class="dt-link-button" onClick={() => void inspect(record.id)}>重试详情</button></Show>
            <Show when={detail()}>{value => <>
              <div class="history-pair"><div><h3>完整原文</h3><p class="history-full-text" dir="auto">{value().entry.sourceText}</p></div>
                <div><h3>完整译文</h3><p class="history-full-text" dir="auto">{value().entry.translatedText}</p></div></div>
              <dl class="history-times"><div><dt>首次生成</dt><dd>{formatTime(value().entry.createdAt)}</dd></div><div><dt>译文更新</dt><dd>{formatTime(value().entry.updatedAt)}</dd></div><div><dt>最近使用</dt><dd>{formatTime(value().entry.lastUsedAt)}</dd></div></dl>
              <h3>消息来源</h3><ul class="history-sources"><For each={value().sources}>{source => <li><div><strong>{source.pageTitle || 'Discord 消息'}</strong><p>服务器 {source.guildId} / 频道 {source.channelId}</p></div>
                <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">查看原消息 ↗</a></li>}</For></ul>
              <p class="history-caption">来源为保存时的快照；原消息可能已被编辑、删除，或当前账号不再拥有访问权限。</p>
            </>}</Show>
          </div>
        </Show>
      </article>}</For>
      <Show when={cursor()}><div class="history-load-more"><button type="button" class="dt-button" disabled={loading()} onClick={() => void load(true)}>加载更早记录</button></div></Show>
    </section>
    <footer class="history-footer">新记录在刷新后显示。删除记录不影响 Discord 原消息，也不会清除当前频道已经显示的译文。</footer>
    <dialog ref={dialog} class="history-dialog" aria-labelledby="delete-title" onCancel={event => { event.preventDefault(); if (!deleting()) cancelDelete(); }}>
      <h2 id="delete-title">{deletion()?.id ? '删除这个词条？' : '清空全部记录？'}</h2>
      <p>{deletion()?.id ? '这个词条及其在所有频道的来源关联将被删除。' : '将删除所有服务器和频道的翻译记录，不限于当前筛选结果。'}</p>
      <p>不会删除 Discord 原消息，也不会清除当前页面已显示的译文。后续翻译可重新生成记录。</p>
      <Show when={deleteError()}><p class="history-dialog-error" role="alert">{deleteError()}</p></Show>
      <div class="history-dialog-actions"><button type="button" class="dt-button history-cancel" autofocus disabled={deleting()} onClick={cancelDelete}>取消</button>
        <button type="button" class="dt-button history-delete" disabled={deleting()} onClick={() => void confirmDelete()}>{deleting() ? '正在删除…' : deletion()?.id ? '确认删除' : '确认清空全部'}</button></div>
    </dialog>
  </main>;
}
