import { parseDiscordChannel } from './discord-route';

export const messageListSelector = 'main ol[data-list-id="chat-messages"]';
export const messageSelector = 'li[id^="chat-messages-"]';
export const ownHostSelector = 'dt-translate-action, dt-translate-result';
const excludedSelector = `${ownHostSelector}, [data-et-buttonswrapper], [data-et-translateresultdiv], script, style, [hidden], [aria-hidden="true"], [class*="hiddenVisually_"], [class*="edited_"], [class*="spoilerContent_"][class*="hidden_"]`;
const blockTags = new Set(['DIV', 'P', 'PRE', 'BLOCKQUOTE', 'LI', 'UL', 'OL']);

export function channelFromUrl(url: string): string | null {
  return parseDiscordChannel(url)?.channelId ?? null;
}
export function extractSourceText(body: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof HTMLElement)) return '';
    if (node.matches(excludedSelector)) return '';
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
    if (node.tagName === 'BR') return '\n';
    if (node instanceof HTMLImageElement) return node.alt;
    const text = Array.from(node.childNodes, walk).join('');
    return node !== body && blockTags.has(node.tagName) ? `\n${text}\n` : text;
  }
  return walk(body).replace(/\r\n?/g, '\n').trim();
}
export interface DiscordMessage {
  channelId: string;
  messageId: string;
  row: HTMLElement;
  body: HTMLElement;
  sourceText: string;
}
export function readMessage(row: HTMLElement, channelId: string): DiscordMessage | null {
  const identity = /^chat-messages-(\d+)-(\d+)$/.exec(row.id);
  if (!identity || identity[1] !== channelId) return null;
  const messageId = identity[2]!;
  const body = row.querySelector<HTMLElement>(`[id="message-content-${messageId}"]`);
  if (!body) return null; // Attachments and system rows have no message body.
  return { channelId, messageId, row, body, sourceText: extractSourceText(body) };
}
