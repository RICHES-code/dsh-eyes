/**
 * dsh-eyes vision engine: calls the zai OpenAI-compatible endpoint with a
 * base64 image, primary glm-4.6v-flash with glm-4v-flash fallback on
 * transient failures (429/5xx/timeout/non-JSON).
 * @module @deepseek-ai/dsh-eyes/zai
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { VisionResult } from './render.ts'
import { SCHEMA_PROMPT } from './schema.ts'

export const ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
export const PRIMARY_MODEL = 'glm-4.6v-flash'
export const FALLBACK_MODEL = 'glm-4v-flash'
const REQUEST_TIMEOUT_MS = 120_000
const CREDENTIALS_PATH = (): string => join(homedir(), '.dsh', '.credentials.yaml')

/** Resolve the ZAI_API_KEY from env then ~/.dsh/.credentials.yaml. */
export function resolveApiKey(): string {
  const fromEnv = process.env.ZAI_API_KEY
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  try {
    const text = readFileSync(CREDENTIALS_PATH(), 'utf8')
    const m = text.match(/ZAI_API_KEY:\s*["']?([^\s"']+)/)
    const key = m?.[1]
    if (key !== undefined && key.length > 0) return key
  } catch { /* fall through */ }
  throw new Error('dsh-eyes: ZAI_API_KEY not set (check process.env or ~/.dsh/.credentials.yaml)')
}

/** One model response: the raw content string (or null). */
interface ZaiResponse { content: string | null }

/** Model max_tokens caps differ: glm-4v-flash accepts at most 1024. */
const MAX_TOKENS: Record<string, number> = {
  [PRIMARY_MODEL]: 4096,
  [FALLBACK_MODEL]: 1024,
}

/** Call the zai endpoint for one model. */
async function callZai(model: string, base64: string, mime: string, prompt: string, signal?: AbortSignal): Promise<ZaiResponse> {
  const apiKey = resolveApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(ZAI_BASE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: MAX_TOKENS[model] ?? 1024,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`zai ${model} HTTP ${res.status}: ${body.slice(0, 300)}`)
    }
    const data = await res.json() as { choices?: { message?: { content?: unknown } }[] }
    const content = data.choices?.[0]?.message?.content
    return { content: typeof content === 'string' ? content : null }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Strip markdown code fences if the model wrapped the JSON. */
function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed)
  const body = fenced?.[1]
  return body !== undefined ? body.trim() : trimmed
}

/** Parse the model's JSON content into the vision result. */
function parseResult(content: string): VisionResult {
  const cleaned = stripFences(content)
  const parsed: unknown = JSON.parse(cleaned)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('dsh-eyes: zai returned non-object JSON')
  }
  return parsed as VisionResult
}

/** Media type by file extension. */
function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  throw new Error(`dsh-eyes: unsupported image extension: ${path} (png/jpg/webp/gif)`)
}

/** The result of one read: the vision object plus routing metadata. */
export interface ZaiReadResult {
  result: VisionResult
  meta: { model: string; attempts: number; ms: number }
}

/**
 * Read one local image path through the vision engine: primary glm-4.6v-flash,
 * falling back to glm-4v-flash once on transient failure.
 * @param path - absolute local image path.
 * @param opts - prompt and cancellation.
 * @returns the parsed six-section vision object plus model/attempt metadata.
 */
export async function readImage(
  path: string,
  opts: { prompt?: string; signal?: AbortSignal },
): Promise<ZaiReadResult> {
  const mime = mimeOf(path)
  const base64 = readFileSync(path).toString('base64')
  const prompt = opts.prompt !== undefined && opts.prompt.length > 0
    ? `图片额外关注点：${opts.prompt}\n\n${SCHEMA_PROMPT}`
    : SCHEMA_PROMPT
  const start = Date.now()
  const models = [PRIMARY_MODEL, FALLBACK_MODEL]
  const failures: string[] = []
  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    if (model === undefined) continue
    try {
      const { content } = await callZai(model, base64, mime, prompt, opts.signal)
      if (content === null) throw new Error(`zai ${model} returned empty content`)
      const result = parseResult(content)
      return { result, meta: { model, attempts: i + 1, ms: Date.now() - start } }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`dsh-eyes: both models failed (glm-4.6v-flash then glm-4v-flash):\n${failures.join('\n')}`)
}
