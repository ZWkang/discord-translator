// USD per million text tokens, checked against https://openrouter.ai/api/v1/models.
// Catalog reference prices are dated; actual provider billing may differ.
export const modelPricesCheckedAt = '2026-09-20';
export const modelPresets = [
  { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen2.5 7B Instruct', inputPrice: '0.10', outputPrice: '0.20' },
  { id: 'qwen/qwen3-30b-a3b-instruct-2507', name: 'Qwen3 30B A3B · Instruct', inputPrice: '0.04815', outputPrice: '0.19305' },
  { id: 'mistralai/ministral-3b-2512', name: 'Ministral 3 · 3B', inputPrice: '0.10', outputPrice: '0.10' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', inputPrice: '0.10', outputPrice: '0.40' },
] as const;
