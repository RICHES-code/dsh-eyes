/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-eyes`.
 * @module @deepseek-ai/dsh-eyes/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-eyes'

/** Cordis companion plugin name. */
export const name = 'dsh-eyes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the vision tool has no independent lifecycle stream;
 * execution relations are owned by the tool registry it registers into.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 */
export function apply(ctx: Context): void {
  ctx.invariants.register(PACKAGE_NAME, install)
}
