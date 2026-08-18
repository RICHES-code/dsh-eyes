/**
 * dsh-eyes vision engine: calls the zai OpenAI-compatible endpoint with a
 * base64 image, primary glm-4.6v-flash with glm-4v-flash fallback on
 * transient failures (429/5xx/timeout/non-JSON).
 * @module @deepseek-ai/dsh-eyes/zai
 */
import type { VisionResult } from './render.ts';
export declare const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/chat/completions";
export declare const PRIMARY_MODEL = "glm-4.6v-flash";
export declare const FALLBACK_MODEL = "glm-4v-flash";
/** Resolve the ZAI_API_KEY from env then ~/.dsh/.credentials.yaml. */
export declare function resolveApiKey(): string;
/** The result of one read: the vision object plus routing metadata. */
export interface ZaiReadResult {
    result: VisionResult;
    meta: {
        model: string;
        attempts: number;
        ms: number;
    };
}
/**
 * Read one local image path through the vision engine: primary glm-4.6v-flash,
 * falling back to glm-4v-flash once on transient failure.
 * @param path - absolute local image path.
 * @param opts - prompt and cancellation.
 * @returns the parsed six-section vision object plus model/attempt metadata.
 */
export declare function readImage(path: string, opts: {
    prompt?: string;
    signal?: AbortSignal;
}): Promise<ZaiReadResult>;
//# sourceMappingURL=zai.d.ts.map