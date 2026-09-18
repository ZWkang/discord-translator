import { messageListSelector, messageSelector, ownHostSelector, readMessage, type DiscordMessage } from './discord-dom';

export function observeMessages(channelId: string, callbacks: {
  update: (message: DiscordMessage) => void;
  remove: (messageId: string) => void;
}) {
  let list: Element | null = null;
  const tracked = new Map<string, HTMLElement>();
  const candidates = new Set<HTMLElement>();
  let frame: number | undefined;
  let stopped = false;
  const collect = (node: Node, descendants = true) => {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    if (!element) return;
    const row = element.closest<HTMLElement>(messageSelector);
    if (row) candidates.add(row);
    if (descendants) for (const child of element.querySelectorAll<HTMLElement>(messageSelector)) candidates.add(child);
  };
  const flush = () => {
    frame = undefined;
    if (stopped) return;
    const current = document.querySelector(messageListSelector);
    if (current !== list) {
      for (const id of tracked.keys()) callbacks.remove(id);
      tracked.clear();
      list = current;
      if (list) collect(list);
    }
    for (const [id, row] of tracked) {
      if (!row.isConnected || !list?.contains(row)) {
        callbacks.remove(id);
        tracked.delete(id);
      }
    }
    for (const row of candidates) {
      if (!row.isConnected || !list?.contains(row)) continue;
      const message = readMessage(row, channelId);
      if (message) {
        tracked.set(message.messageId, row);
        callbacks.update(message);
      } else {
        for (const [id, trackedRow] of tracked) {
          if (trackedRow === row) { callbacks.remove(id); tracked.delete(id); }
        }
      }
    }
    candidates.clear();
  };
  const observer = new MutationObserver((records) => {
    let relevant = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest(ownHostSelector)) continue;
      // Additions caused by our own mount cannot change the source text.
      if (record.type === 'childList' && record.removedNodes.length === 0 && record.addedNodes.length > 0
        && Array.from(record.addedNodes).every((node) => node instanceof Element && node.matches(ownHostSelector))) continue;
      relevant = true;
      collect(record.target, false);
      for (const added of record.addedNodes) collect(added);
    }
    if (relevant && frame === undefined) frame = requestAnimationFrame(flush);
  });
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'id'],
  });
  flush();
  return () => {
    stopped = true;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const id of tracked.keys()) callbacks.remove(id);
    tracked.clear();
  };
}
