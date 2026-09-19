import type { TranslationIdentity, TranslationKey } from './history-types';

export async function createTranslationKey(identity: TranslationIdentity): Promise<TranslationKey> {
  const tuple = [identity.siteOrigin, identity.provider, identity.model, identity.targetLanguage, identity.promptVersion, identity.sourceText];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tuple)));
  const id = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { id, siteOrigin: identity.siteOrigin, provider: identity.provider, model: identity.model,
    targetLanguage: identity.targetLanguage, promptVersion: identity.promptVersion, sourceText: identity.sourceText };
}
