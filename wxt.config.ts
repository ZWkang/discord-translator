import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: 'Discord Translator',
    description: '通过 OpenRouter 手动或自动翻译 Discord 消息，在原文下方阅读译文。',
    icons: {
      16: 'icon/discord-translator.png',
      32: 'icon/discord-translator.png',
      48: 'icon/discord-translator.png',
      96: 'icon/discord-translator.png',
      128: 'icon/discord-translator.png',
    },
    permissions: ['storage'],
    host_permissions: ['https://openrouter.ai/*'],
  },
});
