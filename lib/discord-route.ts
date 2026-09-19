export interface DiscordChannel { guildId: string; channelId: string }

export function parseDiscordChannel(value: string): DiscordChannel | null {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.origin !== 'https://discord.com') return null;
  const match = /^\/channels\/(\d+)\/(\d+)(?:\/\d+)?\/?$/.exec(url.pathname);
  return match ? { guildId: match[1]!, channelId: match[2]! } : null;
}

export function discordMessageUrl(source: DiscordChannel & { messageId: string }): string {
  return `https://discord.com/channels/${source.guildId}/${source.channelId}/${source.messageId}`;
}
