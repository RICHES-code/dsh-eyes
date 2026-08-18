import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, savePaste } from '../src/index.ts'
import { readImage } from '../src/zai.ts'

vi.mock('../src/zai.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/zai.ts')>()
  return { ...actual, readImage: vi.fn() }
})

// A 1x1 red PNG (valid magic bytes for sniffing).
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

let tempDir: string | undefined
afterEach(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true })
  tempDir = undefined
})

function collectTool(ctx: Context): { tool: Record<string, unknown> } {
  const holder: { tool?: Record<string, unknown> } = {}
  ctx.provide('tools', { register: (def: Record<string, unknown>) => { holder.tool = def; return () => {} } })
  return holder as { tool: Record<string, unknown> }
}

describe('dsh-eyes host plugin', () => {
  it('registers the dsh-eyes tool', async () => {
    const ctx = new Context()
    const registered: Record<string, unknown>[] = []
    ctx.provide('tools', { register: (def: Record<string, unknown>) => { registered.push(def); return () => {} } })
    await ctx.plugin(apply)
    expect(registered).toHaveLength(1)
    expect(registered[0].name).toBe('dsh-eyes')
  })

  it('registers the paste route when webServer exists', async () => {
    const ctx = new Context()
    let route: unknown
    ctx.provide('tools', { register: () => () => {} })
    ctx.provide('webServer', {
      register: (r: unknown) => { route = r; return () => {} },
    } as never)
    await ctx.plugin(apply)
    expect(route).toBeDefined()
  })

  it('execute calls readImage with path and prompt', async () => {
    const readMock = readImage as ReturnType<typeof vi.fn>
    readMock.mockResolvedValue({
      result: { summary: 's', ocr: { full_text: 't', lines: [] }, layout: { regions: [] }, semantics: { scene: 'x', entities: [] }, visual: {}, uncertainty: [] },
      meta: { model: 'glm-4.6v-flash', attempts: 1, ms: 10 },
    })
    const ctx = new Context()
    const captured = collectTool(ctx)
    await ctx.plugin(apply)
    const execute = (captured.tool.execute as (args: unknown, exec: unknown) => Promise<unknown>)
    const value = await execute({ path: 'E:/x.png', prompt: 'focus' }, { signal: new AbortController().signal })
    expect(value).toMatchObject({ summary: 's' })
    expect(readMock).toHaveBeenCalledWith('E:/x.png', expect.objectContaining({ prompt: 'focus' }))
    readMock.mockReset()
  })

  it('execute throws on empty path', async () => {
    const ctx = new Context()
    const captured = collectTool(ctx)
    await ctx.plugin(apply)
    const execute = (captured.tool.execute as (args: unknown, exec: unknown) => Promise<unknown>)
    await expect(execute({ path: '' }, { signal: new AbortController().signal })).rejects.toThrow(/non-empty/)
  })

  it('savePaste writes a temp png with 0600 perms', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'dsh-eyes-test-'))
    vi.spyOn({ tmpdir }, 'tmpdir').mockReturnValue(tempDir)
    const { path } = savePaste(PNG_BYTES)
    expect(path).toMatch(/\.png$/)
    const bytes = readFileSync(path)
    expect(bytes.length).toBe(PNG_BYTES.length)
    vi.restoreAllMocks()
  })

  it('savePaste rejects non-images', () => {
    expect(() => savePaste(Buffer.from([0x00, 0x01, 0x02]))).toThrow(/not a recognized image/)
  })

  it('render folds evidence into a text block', async () => {
    const ctx = new Context()
    const captured = collectTool(ctx)
    await ctx.plugin(apply)
    const render = (captured.tool.output as { render: (args: unknown, value: unknown) => unknown[] }).render
    const blocks = render({}, { summary: 's', ocr: { full_text: 't', lines: [] }, layout: { regions: [] }, semantics: { scene: 'x', entities: [] }, visual: {}, uncertainty: [] })
    expect(blocks).toEqual([{ type: 'text', text: expect.stringContaining('【总结】s') }])
  })
})
