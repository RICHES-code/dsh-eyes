/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-eyes`.
 * @module @deepseek-ai/dsh-eyes/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-eyes';
/** Cordis companion plugin name. */
export const name = 'dsh-eyes-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the vision tool has no independent lifecycle stream;
 * execution relations are owned by the tool registry it registers into.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 */
export function apply(ctx) {
    ctx.invariants.register(PACKAGE_NAME, install);
}
//# sourceMappingURL=invariant.js.map