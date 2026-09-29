import { HttpError } from '../utils/HttpError.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 12000;

const SYSTEM_PROMPT = `You are "Post Booster", a LinkedIn post editor. You will be given a LinkedIn post. Rewrite it to be stronger while staying completely faithful to it.

Analyze the original post for:
- Hook: is the first line strong enough to make someone keep reading?
- Message: what is the actual point of the post?
- Structure: does it have a logical progression?
- Readability: can someone quickly scan it on LinkedIn?
- Engagement: are there opportunities to make people think or respond?
- CTA: does the ending naturally encourage interaction?

Then rewrite it, improving:
- Hook
- Flow
- Clarity
- Formatting (short paragraphs, scannable, LinkedIn-native spacing)
- Storytelling, where appropriate
- Specificity
- CTA

You MUST keep unchanged:
- The original idea
- Important facts
- The author's expertise
- The intended audience
- Any genuine personal experiences already in the post

You MUST NEVER invent:
- Personal experiences
- Clients
- Achievements
- Statistics
- Case studies
- Testimonials

If the original post doesn't contain a piece of information (a stat, a client story, a number), do not add one — improve the writing around what's actually there instead.

Output ONLY the rewritten LinkedIn post text. No preamble, no explanation, no markdown formatting, no quotation marks wrapping it, no "Here's the improved version" — just the post itself, ready to paste into LinkedIn.`;

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(originalPost) {
  return fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: originalPost }] }],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function boostPost(originalPost) {
  if (!GEMINI_API_KEY) {
    throw new HttpError(500, 'Post Booster is not configured (missing GEMINI_API_KEY).');
  }

  let res;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let networkError = false;
    try {
      res = await callGemini(originalPost);
    } catch {
      networkError = true;
    }

    // Retry only transient failures: unreachable network, or Gemini 5xx (e.g. "high demand").
    // Never retry 400/401/403 (bad key/request) or 429 (quota) — those won't succeed on a retry.
    const isTransient = networkError || (res && res.status >= 500);
    if (isTransient && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    if (networkError) {
      throw new HttpError(502, 'Could not reach the AI service. Try again in a moment.');
    }
    break;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new HttpError(502, 'The AI service rejected the request (check the Gemini API key).');
    }
    if (res.status === 429) {
      console.error('Gemini API rate limit:', body);
      throw new HttpError(429, 'The AI service is rate-limited right now. Try again shortly.');
    }
    console.error('Gemini API error:', res.status, body);
    throw new HttpError(502, 'The AI service failed to respond. Try again.');
  }

  const data = await res.json();
  const boosted = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();

  if (!boosted) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new HttpError(422, 'That post could not be processed by the AI service.');
    }
    throw new HttpError(502, 'The AI service returned an empty response. Try again.');
  }

  return boosted;
}
