// Anonymous structure based on the inspected Discord DOM; no copied conversation.
export function messageRow(id = '900000000000000001', content = 'The release is ready.') {
  return `<li id="chat-messages-800000000000000001-${id}"><div role="article">
    <div id="message-reply-context-${id}">Quoted message must not be sent</div>
    <div><h3>Sample author</h3><div id="message-content-${id}">${content}</div>
    <div data-et-translateresultdiv>Other extension translation</div></div>
    <div id="message-accessories-${id}">Attachment preview</div>
  </div></li>`;
}
export function channelFixture(content = messageRow()) {
  return `<main><ol data-list-id="chat-messages">${content}</ol></main>`;
}
