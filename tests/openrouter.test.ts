import { describe, expect, it, vi } from 'vitest';
import { translateText, openRouterUrl } from '@/lib/openrouter';
import type { Settings } from '@/lib/messages';
const settings: Settings = { apiKey: 'not-a-real-key', model: 'provider/chosen', targetLanguage: 'ja', revision: 's1', autoTranslate: false };
const complete = { choices: [{ finish_reason: 'stop', message: { content: 'こんにちは' } }] };

describe('OpenRouter contract', () => {
  it('sends exactly the selected message and model without fallback or truncation', async () => {
    const source = 'Hello\nhttps://example.com @friend 👋';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(complete));
    expect(await translateText(settings, source, fetcher)).toBe('こんにちは');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(openRouterUrl);
    expect(init?.headers).toEqual({ Authorization: 'Bearer not-a-real-key', 'Content-Type': 'application/json' });
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe(settings.model);
    expect(body.provider).toEqual({ allow_fallbacks: false });
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toContain('日本語');
    expect(body.messages[1]).toEqual({ role: 'user', content: source });
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('models');
  });
  it.each([[401, 'authentication'], [402, 'payment'], [429, 'rate_limit'], [502, 'provider']])('surfaces %s without retry or raw provider metadata', async (status, kind) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { code: status, message: 'secret-source', metadata: { raw: 'secret-key' } } }, { status: Number(status) }));
    try { await translateText(settings, 'original', fetcher); expect.fail('must reject'); } catch (error) {
      expect(error).toMatchObject({ detail: { kind, status } });
      expect(JSON.stringify(error)).not.toContain('secret');
    }
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    { error: { code: 429 } },
    { choices: [{ ...complete.choices[0], error: { code: 502 } }] },
    { choices: [] },
    { choices: [{ finish_reason: 'stop', message: { content: ' ' } }] },
    { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] },
    { choices: [{ finish_reason: 'content_filter', message: { refusal: 'no' } }] },
    { choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{}] } }] },
  ])('rejects incomplete/failed responses even with HTTP 200', async (body) => {
    await expect(translateText(settings, 'source', vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)))).rejects.toThrow();
  });
  it('exposes malformed JSON and network failures', async () => {
    await expect(translateText(settings, 'source', vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>')))).rejects.toMatchObject({ detail: { kind: 'response' } });
    await expect(translateText(settings, 'source', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))).rejects.toMatchObject({ detail: { kind: 'network' } });
  });
  it('explains incompatible decisions models without exposing raw data or switching models', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: {
      code: 400,
      message: 'typesafe/jev-1.13 is a decisions model and cannot be used with the chat/completions endpoint. Use the /api/alpha/decisions endpoint instead.',
      metadata: { raw: 'private request data' },
    } }, { status: 400 }));
    await expect(translateText(settings, 'source', fetcher)).rejects.toMatchObject({ detail: {
      kind: 'model_incompatible', status: 400, message: '所选模型不支持文本生成，无法进行翻译。请在设置中更换模型。',
    } });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).model).toBe(settings.model);
  });
});
