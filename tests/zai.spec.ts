import { afterEach, describe, expect, it, vi } from 'vitest'
import { readImage, resolveApiKey } from '../src/zai.ts'

// Partially mock node:fs so the key-missing test can force a read failure
// without touching the real ~/.dsh/.credentials.yaml.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readFileSync: vi.fn((...args: Parameters<typeof actual.readFileSync>) => actual.readFileSync(...args)) }
})

const FAKE_RESULT = {
  summary: 'x',
  ocr: { full_text: 't', lines: [{ text: 't' }] },
  layout: { regions: [] },
  semantics: { scene: 's', entities: [] },
  visual: {},
  uncertainty: [],
}

const TEST_IMAGE = 'E:/harnes workspark/generated/deepseek-whale-preview.png'

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })))
}
afterEach(() => { vi.unstubAllGlobals() })

describe('dsh-eyes zai engine', () => {
  it('resolves the key from ZAI_API_KEY env', () => {
    const before = process.env.ZAI_API_KEY
    process.env.ZAI_API_KEY = 'env-key'
    try {
      expect(resolveApiKey()).toBe('env-key')
    } finally { process.env.ZAI_API_KEY = before }
  })

  it('reads an image and returns the six-section result via glm-4.6v-flash', async () => {
    mockFetchOnce(200, { choices: [{ message: { content: JSON.stringify(FAKE_RESULT) } }], usage: {} })
    const res = await readImage(TEST_IMAGE, {})
    expect(res.result.summary).toBe('x')
    expect(res.meta.model).toBe('glm-4.6v-flash')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to glm-4v-flash on 429', async () => {
    const okBody = JSON.stringify({ choices: [{ message: { content: JSON.stringify(FAKE_RESULT) } }] })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 1305 } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(okBody, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await readImage(TEST_IMAGE, {})
    expect(res.result.summary).toBe('x')
    expect(res.meta.model).toBe('glm-4v-flash')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('strips markdown code fences from the model output', async () => {
    mockFetchOnce(200, { choices: [{ message: { content: '```json\n' + JSON.stringify(FAKE_RESULT) + '\n```' } }], usage: {} })
    const res = await readImage(TEST_IMAGE, {})
    expect(res.result.summary).toBe('x')
  })

  it('throws a clear error when both models fail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(readImage(TEST_IMAGE, {})).rejects.toThrow(/both models failed/)
  })

  it('throws a clear error when the key is missing', async () => {
    const before = process.env.ZAI_API_KEY
    const fsMock = await import('node:fs') as typeof import('node:fs') & { readFileSync: ReturnType<typeof vi.fn> }
    fsMock.readFileSync.mockImplementationOnce(() => { throw new Error('ENOENT') })
    delete process.env.ZAI_API_KEY
    try {
      expect(() => resolveApiKey()).toThrow(/ZAI_API_KEY/)
    } finally {
      process.env.ZAI_API_KEY = before
      fsMock.readFileSync.mockRestore()
    }
  })

  it('throws on unsupported image extension', async () => {
    await expect(readImage('E:/x.txt', {})).rejects.toThrow(/unsupported image extension/)
  })
})
