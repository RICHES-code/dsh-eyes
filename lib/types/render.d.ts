/**
 * Fold the six-section vision JSON into model-readable text so the model
 * quotes evidence instead of re-parsing the raw JSON.
 * @module @deepseek-ai/dsh-eyes/render
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
/** A vision result value (the 6-section object, matching VISION_SCHEMA). */
export interface VisionResult {
    summary: string;
    ocr: {
        full_text: string;
        lines: {
            text: string;
            language?: string;
        }[];
    };
    layout: {
        regions: {
            type: string;
            reading_order: number;
            text: string;
        }[];
    };
    semantics: {
        scene: string;
        intent?: string;
        entities: {
            name: string;
            type: string;
            evidence?: string;
        }[];
        relations?: {
            subject: string;
            predicate: string;
            object: string;
        }[];
    };
    visual: {
        dominant_colors?: string[];
        style?: string;
        notes?: string[];
    };
    uncertainty: string[];
}
/** Render one validated vision value as a text content block. */
export declare function renderEvidence(value: VisionResult): ContentBlock[];
//# sourceMappingURL=render.d.ts.map