/**
 * dsh-eyes host half: registers the dsh-eyes vision tool and, when a
 * webServer is present, the /vision/paste route that turns pasted image
 * bytes into a temp file path for the browser half.
 * @module @deepseek-ai/dsh-eyes
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { renderEvidence } from "./render.js";
import { VISION_SCHEMA } from "./schema.js";
import { readImage } from "./zai.js";
export const name = 'dsh-eyes';
export const inject = ['tools'];
const TOOL_TIMEOUT_MS = 180_000 + 20_000;
const PASTE_MAX_BYTES = 20 * 1024 * 1024;
/** Sniff image type from the first bytes (PNG/JPEG/GIF/WebP). */
function sniffImageType(bytes) {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
        return 'png';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'jpg';
    if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
        return 'gif';
    if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
        return 'webp';
    return undefined;
}
const EXT = { png: '.png', jpg: '.jpg', gif: '.gif', webp: '.webp' };
/** Write pasted bytes to a private temp file and return its path. */
export function savePaste(bytes) {
    const kind = sniffImageType(bytes);
    if (kind === undefined)
        throw new Error('dsh-eyes: not a recognized image (png/jpeg/gif/webp)');
    if (bytes.length > PASTE_MAX_BYTES)
        throw new Error(`dsh-eyes: image over the ${PASTE_MAX_BYTES}-byte limit`);
    const dir = join(tmpdir(), 'dsh-eyes');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${randomUUID()}${EXT[kind]}`);
    writeFileSync(path, bytes, { mode: 0o600 });
    return { path };
}
export function apply(ctx) {
    ctx.tools.register(defineTool({
        name: 'dsh-eyes',
        description: 'Read an image through the dsh-eyes vision bridge (zai glm-4.6v-flash). Use whenever a message references an image the current model cannot see: a local file path or http(s) URL to a screenshot, photo, chart, diagram, or document scan. Returns structured evidence (ocr.full_text, layout regions in reading order, semantics, uncertainty); quote the evidence instead of guessing. Falls back to glm-4v-flash on rate limits.',
        parameters: {
            path: { type: 'string', required: true, description: 'Absolute local file path or http(s) URL of the image' },
            prompt: { type: 'string', description: 'Optional extra focus for the reading (e.g. "focus on the axis labels")' },
        },
        output: {
            schema: VISION_SCHEMA,
            render: (_args, value) => renderEvidence(value),
        },
        timeoutMs: TOOL_TIMEOUT_MS,
        isConcurrencySafe: () => true,
        presentCall: (args) => {
            const path = args.path;
            return {
                card: 'generic',
                title: 'dsh-eyes',
                kind: 'read',
                rawInput: args,
                ...(typeof path === 'string' && !/^https?:\/\//i.test(path)
                    ? { locations: [{ path }] }
                    : {}),
            };
        },
        async execute(args, exec) {
            const path = args.path;
            const prompt = args.prompt;
            if (typeof path !== 'string' || path.trim() === '') {
                throw new Error('dsh-eyes needs a non-empty string "path".');
            }
            const { result } = await readImage(path, {
                ...(prompt !== undefined && prompt.length > 0 ? { prompt } : {}),
                signal: exec.signal,
            });
            return result;
        },
    }));
    // Paste route: only under a webServer carrier (headless has none).
    ctx.inject(['webServer'], (scope) => {
        const server = scope.webServer;
        const handler = async (req, res) => {
            const chunks = [];
            let total = 0;
            // IncomingMessage implements node:stream Readable; for await works via
            // its async iterator (typed as AsyncIterableIterator<Buffer>).
            const stream = req;
            for await (const chunk of stream) {
                chunks.push(chunk);
                total += chunk.length;
                if (total > PASTE_MAX_BYTES) {
                    res.writeHead(413);
                    res.end(JSON.stringify({ error: 'image too large' }));
                    return;
                }
            }
            const bytes = Buffer.concat(chunks);
            try {
                const { path } = savePaste(bytes);
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ path }));
            }
            catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
            }
        };
        server.register({ kind: 'exact', path: '/vision/paste', handler });
    });
}
//# sourceMappingURL=index.js.map