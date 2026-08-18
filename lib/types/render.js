/**
 * Fold the six-section vision JSON into model-readable text so the model
 * quotes evidence instead of re-parsing the raw JSON.
 * @module @deepseek-ai/dsh-eyes/render
 */
/** Render one validated vision value as a text content block. */
export function renderEvidence(value) {
    const parts = [];
    parts.push(`【总结】${value.summary}`);
    if (value.ocr.full_text)
        parts.push(`【全文转写】\n${value.ocr.full_text}`);
    if (value.layout.regions.length) {
        parts.push('【版面布局（阅读顺序）】');
        for (const r of value.layout.regions) {
            parts.push(`  ${r.reading_order}. [${r.type}] ${r.text}`);
        }
    }
    if (value.semantics.entities.length) {
        parts.push('【实体】');
        for (const e of value.semantics.entities) {
            parts.push(`  ${e.name} (${e.type})${e.evidence ? ` — 证据: ${e.evidence}` : ''}`);
        }
    }
    if (value.semantics.relations?.length) {
        parts.push('【关系】');
        for (const r of value.semantics.relations) {
            parts.push(`  ${r.subject} → ${r.predicate} → ${r.object}`);
        }
    }
    if (value.visual.dominant_colors?.length)
        parts.push(`【主色调】${value.visual.dominant_colors.join(', ')}`);
    if (value.visual.style)
        parts.push(`【风格】${value.visual.style}`);
    if (value.visual.notes?.length)
        parts.push(`【视觉细节】${value.visual.notes.join('; ')}`);
    if (value.uncertainty.length)
        parts.push(`【不确定项】${value.uncertainty.join('; ')}`);
    return [{ type: 'text', text: parts.join('\n') }];
}
//# sourceMappingURL=render.js.map