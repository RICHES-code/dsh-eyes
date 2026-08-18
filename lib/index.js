import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/render.js
/**
* Fold the six-section vision JSON into model-readable text so the model
* quotes evidence instead of re-parsing the raw JSON.
* @module @deepseek-ai/dsh-eyes/render
*/
/** Render one validated vision value as a text content block. */
function renderEvidence(value) {
	const parts = [];
	parts.push(`【总结】${value.summary}`);
	if (value.ocr.full_text) parts.push(`【全文转写】\n${value.ocr.full_text}`);
	if (value.layout.regions.length) {
		parts.push("【版面布局（阅读顺序）】");
		for (const r of value.layout.regions) parts.push(`  ${r.reading_order}. [${r.type}] ${r.text}`);
	}
	if (value.semantics.entities.length) {
		parts.push("【实体】");
		for (const e of value.semantics.entities) parts.push(`  ${e.name} (${e.type})${e.evidence ? ` — 证据: ${e.evidence}` : ""}`);
	}
	if (value.semantics.relations?.length) {
		parts.push("【关系】");
		for (const r of value.semantics.relations) parts.push(`  ${r.subject} → ${r.predicate} → ${r.object}`);
	}
	if (value.visual.dominant_colors?.length) parts.push(`【主色调】${value.visual.dominant_colors.join(", ")}`);
	if (value.visual.style) parts.push(`【风格】${value.visual.style}`);
	if (value.visual.notes?.length) parts.push(`【视觉细节】${value.visual.notes.join("; ")}`);
	if (value.uncertainty.length) parts.push(`【不确定项】${value.uncertainty.join("; ")}`);
	return [{
		type: "text",
		text: parts.join("\n")
	}];
}
//#endregion
//#region lib/types/schema.js
/**
* dsh-eyes vision output schema and the schema-enforcing prompt.
* The six-section structure follows the modlens vision contract so models
* quote evidence instead of guessing.
* @module @deepseek-ai/dsh-eyes/schema
*/
/** Vision output schema in the dsh-tools value-schema DSL. */
const VISION_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		summary: {
			type: "string",
			required: true
		},
		ocr: {
			type: "object",
			additionalProperties: false,
			properties: {
				full_text: {
					type: "string",
					required: true
				},
				lines: {
					type: "array",
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							text: {
								type: "string",
								required: true
							},
							language: { type: "string" }
						}
					},
					required: true
				}
			}
		},
		layout: {
			type: "object",
			additionalProperties: false,
			properties: { regions: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						type: {
							type: "string",
							description: "A short kind: title, heading, paragraph, list, table, chart, form, code, image, icon, link, nav, button, search",
							required: true
						},
						reading_order: {
							type: "number",
							required: true
						},
						text: {
							type: "string",
							required: true
						}
					}
				},
				required: true
			} }
		},
		semantics: {
			type: "object",
			additionalProperties: false,
			properties: {
				scene: {
					type: "string",
					required: true
				},
				intent: { type: "string" },
				entities: {
					type: "array",
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							name: {
								type: "string",
								required: true
							},
							type: {
								type: "string",
								required: true
							},
							evidence: { type: "string" }
						}
					},
					required: true
				},
				relations: {
					type: "array",
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							subject: {
								type: "string",
								required: true
							},
							predicate: {
								type: "string",
								required: true
							},
							object: {
								type: "string",
								required: true
							}
						}
					}
				}
			}
		},
		visual: {
			type: "object",
			additionalProperties: false,
			properties: {
				dominant_colors: {
					type: "array",
					items: { type: "string" }
				},
				style: { type: "string" },
				notes: {
					type: "array",
					items: { type: "string" }
				}
			}
		},
		uncertainty: {
			type: "array",
			items: { type: "string" }
		}
	}
};
/** Chinese prompt that forces glm-4v-flash to emit exactly the six-section JSON. */
const SCHEMA_PROMPT = `你是图像理解引擎。把这张图片转换成严格 JSON，字段和结构必须完全符合以下 JSON Schema：
${JSON.stringify(VISION_SCHEMA, null, 2)}
规则：
- ocr.full_text 逐字转写所有可见文字，ocr.lines 逐行列出（含语言）
- layout.regions 按阅读顺序列出所有区域（type 用 title/heading/paragraph/list/table/chart/form/code/image/icon/link/nav/button/search 之一）
- semantics.scene 描述场景，semantics.entities 列出关键实体（人物/物体/数字/品牌，附 evidence 引用图中证据）
- semantics.relations 列出实体间关系（subject/predicate/object）
- visual.dominant_colors 列出主色调，visual.style 描述风格，visual.notes 补充视觉细节
- uncertainty 列出你无法确定的内容，绝不编造
只输出 JSON，不要任何解释、不要 markdown 代码块围栏（不要用 \`\`\` 包裹 JSON）。`;
//#endregion
//#region lib/types/zai.js
/**
* dsh-eyes vision engine: calls the zai OpenAI-compatible endpoint with a
* base64 image, primary glm-4.6v-flash with glm-4v-flash fallback on
* transient failures (429/5xx/timeout/non-JSON).
* @module @deepseek-ai/dsh-eyes/zai
*/
const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const PRIMARY_MODEL = "glm-4.6v-flash";
const FALLBACK_MODEL = "glm-4v-flash";
const REQUEST_TIMEOUT_MS = 12e4;
const CREDENTIALS_PATH = () => join(homedir(), ".dsh", ".credentials.yaml");
/** Resolve the ZAI_API_KEY from env then ~/.dsh/.credentials.yaml. */
function resolveApiKey() {
	const fromEnv = process.env.ZAI_API_KEY;
	if (fromEnv !== void 0 && fromEnv.length > 0) return fromEnv;
	try {
		const key = readFileSync(CREDENTIALS_PATH(), "utf8").match(/ZAI_API_KEY:\s*["']?([^\s"']+)/)?.[1];
		if (key !== void 0 && key.length > 0) return key;
	} catch {}
	throw new Error("dsh-eyes: ZAI_API_KEY not set (check process.env or ~/.dsh/.credentials.yaml)");
}
/** Model max_tokens caps differ: glm-4v-flash accepts at most 1024. */
const MAX_TOKENS = {
	[PRIMARY_MODEL]: 4096,
	[FALLBACK_MODEL]: 1024
};
/** Call the zai endpoint for one model. */
async function callZai(model, base64, mime, prompt, signal) {
	const apiKey = resolveApiKey();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		const res = await fetch(ZAI_BASE_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: [{
					role: "user",
					content: [{
						type: "image_url",
						image_url: { url: `data:${mime};base64,${base64}` }
					}, {
						type: "text",
						text: prompt
					}]
				}],
				max_tokens: MAX_TOKENS[model] ?? 1024
			}),
			signal: controller.signal
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`zai ${model} HTTP ${res.status}: ${body.slice(0, 300)}`);
		}
		const content = (await res.json()).choices?.[0]?.message?.content;
		return { content: typeof content === "string" ? content : null };
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", onAbort);
	}
}
/** Strip markdown code fences if the model wrapped the JSON. */
function stripFences(text) {
	const trimmed = text.trim();
	const body = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed)?.[1];
	return body !== void 0 ? body.trim() : trimmed;
}
/** Parse the model's JSON content into the vision result. */
function parseResult(content) {
	const cleaned = stripFences(content);
	const parsed = JSON.parse(cleaned);
	if (typeof parsed !== "object" || parsed === null) throw new Error("dsh-eyes: zai returned non-object JSON");
	return parsed;
}
/** Media type by file extension. */
function mimeOf(path) {
	const lower = path.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	throw new Error(`dsh-eyes: unsupported image extension: ${path} (png/jpg/webp/gif)`);
}
/**
* Read one local image path through the vision engine: primary glm-4.6v-flash,
* falling back to glm-4v-flash once on transient failure.
* @param path - absolute local image path.
* @param opts - prompt and cancellation.
* @returns the parsed six-section vision object plus model/attempt metadata.
*/
async function readImage(path, opts) {
	const mime = mimeOf(path);
	const base64 = readFileSync(path).toString("base64");
	const prompt = opts.prompt !== void 0 && opts.prompt.length > 0 ? `图片额外关注点：${opts.prompt}\n\n${SCHEMA_PROMPT}` : SCHEMA_PROMPT;
	const start = Date.now();
	const models = [PRIMARY_MODEL, FALLBACK_MODEL];
	const failures = [];
	for (let i = 0; i < models.length; i++) {
		const model = models[i];
		if (model === void 0) continue;
		try {
			const { content } = await callZai(model, base64, mime, prompt, opts.signal);
			if (content === null) throw new Error(`zai ${model} returned empty content`);
			return {
				result: parseResult(content),
				meta: {
					model,
					attempts: i + 1,
					ms: Date.now() - start
				}
			};
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}
	throw new Error(`dsh-eyes: both models failed (glm-4.6v-flash then glm-4v-flash):\n${failures.join("\n")}`);
}
//#endregion
//#region lib/types/index.js
/**
* dsh-eyes host half: registers the dsh-eyes vision tool and, when a
* webServer is present, the /vision/paste route that turns pasted image
* bytes into a temp file path for the browser half.
* @module @deepseek-ai/dsh-eyes
*/
const name = "dsh-eyes";
const inject = ["tools"];
const TOOL_TIMEOUT_MS = 2e5;
const PASTE_MAX_BYTES = 20971520;
/** Sniff image type from the first bytes (PNG/JPEG/GIF/WebP). */
function sniffImageType(bytes) {
	if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "png";
	if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
	if (bytes.length >= 4 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56) return "gif";
	if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return "webp";
}
const EXT = {
	png: ".png",
	jpg: ".jpg",
	gif: ".gif",
	webp: ".webp"
};
/** Write pasted bytes to a private temp file and return its path. */
function savePaste(bytes) {
	const kind = sniffImageType(bytes);
	if (kind === void 0) throw new Error("dsh-eyes: not a recognized image (png/jpeg/gif/webp)");
	if (bytes.length > PASTE_MAX_BYTES) throw new Error(`dsh-eyes: image over the ${PASTE_MAX_BYTES}-byte limit`);
	const dir = join(tmpdir(), "dsh-eyes");
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${randomUUID()}${EXT[kind]}`);
	writeFileSync(path, bytes, { mode: 384 });
	return { path };
}
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "dsh-eyes",
		description: "Read an image through the dsh-eyes vision bridge (zai glm-4.6v-flash). Use whenever a message references an image the current model cannot see: a local file path or http(s) URL to a screenshot, photo, chart, diagram, or document scan. Returns structured evidence (ocr.full_text, layout regions in reading order, semantics, uncertainty); quote the evidence instead of guessing. Falls back to glm-4v-flash on rate limits.",
		parameters: {
			path: {
				type: "string",
				required: true,
				description: "Absolute local file path or http(s) URL of the image"
			},
			prompt: {
				type: "string",
				description: "Optional extra focus for the reading (e.g. \"focus on the axis labels\")"
			}
		},
		output: {
			schema: VISION_SCHEMA,
			render: (_args, value) => renderEvidence(value)
		},
		timeoutMs: TOOL_TIMEOUT_MS,
		isConcurrencySafe: () => true,
		presentCall: (args) => {
			const path = args.path;
			return {
				card: "generic",
				title: "dsh-eyes",
				kind: "read",
				rawInput: args,
				...typeof path === "string" && !/^https?:\/\//i.test(path) ? { locations: [{ path }] } : {}
			};
		},
		async execute(args, exec) {
			const path = args.path;
			const prompt = args.prompt;
			if (typeof path !== "string" || path.trim() === "") throw new Error("dsh-eyes needs a non-empty string \"path\".");
			const { result } = await readImage(path, {
				...prompt !== void 0 && prompt.length > 0 ? { prompt } : {},
				signal: exec.signal
			});
			return result;
		}
	}));
	ctx.inject(["webServer"], (scope) => {
		const server = scope.webServer;
		const handler = async (req, res) => {
			const chunks = [];
			let total = 0;
			const stream = req;
			for await (const chunk of stream) {
				chunks.push(chunk);
				total += chunk.length;
				if (total > PASTE_MAX_BYTES) {
					res.writeHead(413);
					res.end(JSON.stringify({ error: "image too large" }));
					return;
				}
			}
			const bytes = Buffer.concat(chunks);
			try {
				const { path } = savePaste(bytes);
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify({ path }));
			} catch (error) {
				res.writeHead(400);
				res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
			}
		};
		server.register({
			kind: "exact",
			path: "/vision/paste",
			handler
		});
	});
}
//#endregion
export { apply, inject, name, savePaste };
