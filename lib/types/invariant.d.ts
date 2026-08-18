/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-eyes`.
 * @module @deepseek-ai/dsh-eyes/invariant
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "dsh-eyes-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=invariant.d.ts.map