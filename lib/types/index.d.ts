/**
 * dsh-eyes host half: registers the dsh-eyes vision tool and, when a
 * webServer is present, the /vision/paste route that turns pasted image
 * bytes into a temp file path for the browser half.
 * @module @deepseek-ai/dsh-eyes
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-eyes";
export declare const inject: string[];
/** Write pasted bytes to a private temp file and return its path. */
export declare function savePaste(bytes: Uint8Array): {
    path: string;
};
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map