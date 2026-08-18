/**
 * dsh-eyes vision output schema and the schema-enforcing prompt.
 * The six-section structure follows the modlens vision contract so models
 * quote evidence instead of guessing.
 * @module @deepseek-ai/dsh-eyes/schema
 */

/** Vision output schema in the dsh-tools value-schema DSL. */
export const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', required: true },
    ocr: {
      type: 'object',
      additionalProperties: false,
      properties: {
        full_text: { type: 'string', required: true },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string', required: true },
              language: { type: 'string' },
            },
          },
          required: true,
        },
      },
    },
    layout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        regions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: {
                type: 'string',
                description: 'A short kind: title, heading, paragraph, list, table, chart, form, code, image, icon, link, nav, button, search',
                required: true,
              },
              reading_order: { type: 'number', required: true },
              text: { type: 'string', required: true },
            },
          },
          required: true,
        },
      },
    },
    semantics: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scene: { type: 'string', required: true },
        intent: { type: 'string' },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', required: true },
              type: { type: 'string', required: true },
              evidence: { type: 'string' },
            },
          },
          required: true,
        },
        relations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              subject: { type: 'string', required: true },
              predicate: { type: 'string', required: true },
              object: { type: 'string', required: true },
            },
          },
        },
      },
    },
    visual: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dominant_colors: { type: 'array', items: { type: 'string' } },
        style: { type: 'string' },
        notes: { type: 'array', items: { type: 'string' } },
      },
    },
    uncertainty: { type: 'array', items: { type: 'string' } },
  },
} as const

/** The schema serialized to JSON, embedded in the prompt sent to zai. */
export const VISION_SCHEMA_JSON = JSON.stringify(VISION_SCHEMA, null, 2)

/** Chinese prompt that forces glm-4v-flash to emit exactly the six-section JSON. */
export const SCHEMA_PROMPT = `你是图像理解引擎。把这张图片转换成严格 JSON，字段和结构必须完全符合以下 JSON Schema：
${VISION_SCHEMA_JSON}
规则：
- ocr.full_text 逐字转写所有可见文字，ocr.lines 逐行列出（含语言）
- layout.regions 按阅读顺序列出所有区域（type 用 title/heading/paragraph/list/table/chart/form/code/image/icon/link/nav/button/search 之一）
- semantics.scene 描述场景，semantics.entities 列出关键实体（人物/物体/数字/品牌，附 evidence 引用图中证据）
- semantics.relations 列出实体间关系（subject/predicate/object）
- visual.dominant_colors 列出主色调，visual.style 描述风格，visual.notes 补充视觉细节
- uncertainty 列出你无法确定的内容，绝不编造
只输出 JSON，不要任何解释、不要 markdown 代码块围栏（不要用 \`\`\` 包裹 JSON）。`
