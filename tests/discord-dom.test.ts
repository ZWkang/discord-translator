import { afterEach, describe, expect, it } from 'vitest';
import { channelFromUrl, readMessage } from '@/lib/discord-dom';
import { observeMessages } from '@/lib/discord-observer';
import { channelFixture, messageRow } from './fixtures/discord';
import { vi } from 'vitest';
const channel = '800000000000000001';
afterEach(() => { document.body.innerHTML = ''; });
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 35));

describe('Discord adapter', () => {
  it('keeps snowflakes as strings and recognizes channel navigation', () => {
    expect(channelFromUrl(`https://discord.com/channels/7/${channel}`)).toBe(channel);
    expect(channelFromUrl('https://discord.com/channels/@me/7')).toBeNull();
  });
  it('extracts only the original visible message, preserving rich text', () => {
    document.body.innerHTML = channelFixture(messageRow(undefined, '<span>Hello</span><br><a href="https://example.com">link</a> <span role="button">@friend</span> <img alt="👋"><pre>const x = 1;</pre><span hidden>hidden</span><span class="spoilerContent_abc hidden_xyz">secret</span><span class="edited_abc">(edited)</span><div data-et-buttonswrapper>Translate</div><dt-translate-action>翻译</dt-translate-action>'));
    const result = readMessage(document.querySelector('li')!, channel)!;
    expect(result.messageId).toBe('900000000000000001');
    expect(result.sourceText).toBe('Hello\nlink @friend 👋\nconst x = 1;');
    expect(readMessage(document.querySelector('li')!, 'wrong-channel')).toBeNull();
    result.body.hidden = true;
    expect(readMessage(document.querySelector('li')!, channel)!.sourceText).toBe('');
  });
  it('observes new messages, text edits and replaced lists, then stops cleanly', async () => {
    document.body.innerHTML = channelFixture();
    const update = vi.fn();
    const remove = vi.fn();
    const stop = observeMessages(channel, { update, remove });
    expect(update).toHaveBeenCalledOnce();
    const body = document.querySelector('[id^="message-content-"]')!;
    body.append(document.createElement('dt-translate-action'));
    await nextFrame();
    expect(update).toHaveBeenCalledOnce();
    body.firstChild!.textContent = 'Edited';
    await nextFrame();
    expect(update.mock.lastCall?.[0].sourceText).toBe('Edited');
    document.querySelector('ol')!.insertAdjacentHTML('beforeend', messageRow('900000000000000002'));
    await nextFrame();
    expect(update.mock.lastCall?.[0].messageId).toBe('900000000000000002');
    document.querySelector('main')!.innerHTML = '<ol data-list-id="chat-messages"></ol>';
    await nextFrame();
    expect(remove).toHaveBeenCalledWith('900000000000000001');
    stop();
    const count = update.mock.calls.length;
    document.querySelector('ol')!.insertAdjacentHTML('beforeend', messageRow());
    await nextFrame();
    expect(update).toHaveBeenCalledTimes(count);
  });
  it('excludes hidden edited timestamps while preserving dates in the visible message', () => {
    document.body.innerHTML = channelFixture(messageRow(undefined, '<span>Meet at </span><time>2026-09-18</time><span class="timestamp_xyz"><span><time><span class="edited_xyz">(edited)</span></time></span><span class="hiddenVisually_xyz">Friday September 18, 2026 17:14</span></span>'));
    expect(readMessage(document.querySelector('li')!, channel)!.sourceText).toBe('Meet at 2026-09-18');
  });
  it('removes an injected view when only the original body disappears', async () => {
    document.body.innerHTML = channelFixture();
    const remove = vi.fn();
    const stop = observeMessages(channel, { update: vi.fn(), remove });
    document.querySelector('[id^="message-content-"]')!.remove();
    await nextFrame();
    expect(remove).toHaveBeenCalledWith('900000000000000001');
    stop();
  });
});
