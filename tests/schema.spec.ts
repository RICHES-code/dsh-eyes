import { describe, expect, it } from 'vitest'
import { SCHEMA_PROMPT, VISION_SCHEMA } from '../src/schema.ts'

type AnySchema = { type: string; required?: boolean; properties?: Record<string, AnySchema> }

function props(schema: AnySchema): Record<string, AnySchema> {
  return schema.properties ?? {}
}

describe('dsh-eyes vision schema', () => {
  it('declares all six sections at the top level', () => {
    expect(VISION_SCHEMA.type).toBe('object')
    const p = props(VISION_SCHEMA as AnySchema)
    for (const key of ['summary', 'ocr', 'layout', 'semantics', 'visual', 'uncertainty']) {
      expect(p[key]).toBeDefined()
    }
    // summary is required (property-level `required: true` in the DSL)
    expect(p.summary.required).toBe(true)
  })

  it('ocr section has full_text and lines', () => {
    const p = props(props(VISION_SCHEMA as AnySchema).ocr)
    expect(p.full_text).toBeDefined()
    expect(p.lines.type).toBe('array')
  })

  it('semantics requires scene and entities (property-level required)', () => {
    const p = props(props(VISION_SCHEMA as AnySchema).semantics)
    expect(p.scene.required).toBe(true)
    expect(p.entities.required).toBe(true)
  })

  it('schema-enforcing prompt embeds the schema and forbids markdown fences', () => {
    expect(SCHEMA_PROMPT).toContain('summary')
    expect(SCHEMA_PROMPT).toContain('只输出 JSON')
    expect(SCHEMA_PROMPT).toMatch(/```/)
  })
})
