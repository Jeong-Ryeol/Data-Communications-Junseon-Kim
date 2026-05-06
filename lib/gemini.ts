import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM = `You are a content moderator for a classroom Q&A app used by Korean university students.
Classify the message as exactly "ALLOW" or "BLOCK".

BLOCK if the message is:
- Korean profanity or vulgar language, including:
  · direct words: 시발, 씨발, 좆, 병신, 존나, 미친놈, 개새끼 등
  · jamo evasion: ㅅㅂ, ㅈㄴ, ㅂㅅ, ㄱㅅㄲ
  · spaced/altered: 시-발, 씨1발, 시 발
  · ㅗ / ㅗㅗ (한국 텍스트 가운뎃손가락 욕)
- English profanity: fuck, shit, bitch, etc.
- spam / advertising / external commercial links
- targeted harassment of a specific named person
- meaningless gibberish, random key smashing (asdfasdf, ㅁㄴㅇㄻㄴㅇㄻ)
- pure ㅋㅋㅋㅋ or ㅎㅎㅎ with no question content

DO NOT BLOCK:
- short genuine questions like "왜요?", "뭐예요?", "?"
- naive or basic questions about course material
- mild expressions of frustration ("어렵네요", "헷갈려요")
- typos / grammatical errors

Respond with exactly one word: ALLOW or BLOCK.`;

export type ModerationResult = {
  verdict: 'ALLOW' | 'BLOCK';
  /** Gemini 무료 한도 초과 (429) — graceful fallback ALLOW이지만 별도 표시 */
  quotaExceeded?: boolean;
  /** 그 외 외부 API 장애 */
  unavailable?: boolean;
};

export async function moderate(text: string): Promise<ModerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { verdict: 'ALLOW', unavailable: true };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const r = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${SYSTEM}\n\nMessage: """${text}"""` }] },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 4 },
    });
    const out = r.response.text().trim().toUpperCase();
    return { verdict: out.includes('BLOCK') ? 'BLOCK' : 'ALLOW' };
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const msg = String(err?.message ?? '');
    const status = err?.status;
    const isQuota =
      status === 429 || /429|quota|rate limit|resource_exhausted/i.test(msg);
    if (isQuota) {
      console.warn('[gemini] quota exceeded — falling back to ALLOW');
      return { verdict: 'ALLOW', quotaExceeded: true };
    }
    console.error('[gemini] moderation error', e);
    return { verdict: 'ALLOW', unavailable: true };
  }
}
