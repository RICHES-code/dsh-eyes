/**
 * dsh-eyes vision output schema and the schema-enforcing prompt.
 * The six-section structure follows the modlens vision contract so models
 * quote evidence instead of guessing.
 * @module @deepseek-ai/dsh-eyes/schema
 */
/** Vision output schema in the dsh-tools value-schema DSL. */
export declare const VISION_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly summary: {
            readonly type: "string";
            readonly required: true;
        };
        readonly ocr: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly full_text: {
                    readonly type: "string";
                    readonly required: true;
                };
                readonly lines: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly text: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly language: {
                                readonly type: "string";
                            };
                        };
                    };
                    readonly required: true;
                };
            };
        };
        readonly layout: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly regions: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly type: {
                                readonly type: "string";
                                readonly description: "A short kind: title, heading, paragraph, list, table, chart, form, code, image, icon, link, nav, button, search";
                                readonly required: true;
                            };
                            readonly reading_order: {
                                readonly type: "number";
                                readonly required: true;
                            };
                            readonly text: {
                                readonly type: "string";
                                readonly required: true;
                            };
                        };
                    };
                    readonly required: true;
                };
            };
        };
        readonly semantics: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly scene: {
                    readonly type: "string";
                    readonly required: true;
                };
                readonly intent: {
                    readonly type: "string";
                };
                readonly entities: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly name: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly type: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly evidence: {
                                readonly type: "string";
                            };
                        };
                    };
                    readonly required: true;
                };
                readonly relations: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly subject: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly predicate: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly object: {
                                readonly type: "string";
                                readonly required: true;
                            };
                        };
                    };
                };
            };
        };
        readonly visual: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly dominant_colors: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
                readonly style: {
                    readonly type: "string";
                };
                readonly notes: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
            };
        };
        readonly uncertainty: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
    };
};
/** The schema serialized to JSON, embedded in the prompt sent to zai. */
export declare const VISION_SCHEMA_JSON: string;
/** Chinese prompt that forces glm-4v-flash to emit exactly the six-section JSON. */
export declare const SCHEMA_PROMPT: string;
//# sourceMappingURL=schema.d.ts.map