window.__ModuleLoader__.load({
	id: "dsh-eyes",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		/**
		* dsh-eyes browser half: intercepts image pastes and routes the bytes to the
		* host /vision/paste route, returning a temp file path the model can read via
		* the dsh-eyes tool.
		* @module @deepseek-ai/dsh-eyes/client
		*/
		const PASTE_PATH = "/vision/paste";
		const IMAGE_TYPES = /* @__PURE__ */ new Set([
			"image/png",
			"image/jpeg",
			"image/webp",
			"image/gif"
		]);
		function insertIntoComposer(text) {
			const composer = document.querySelector("[contenteditable=\"true\"]");
			if (composer === null) {
				console.warn(`[dsh-eyes] no composer found; paste path: ${text}`);
				return;
			}
			composer.focus();
			const selection = window.getSelection();
			if (selection === null) return;
			selection.selectAllChildren(composer);
			selection.collapseToEnd();
			document.execCommand("insertText", false, ` ${text} `);
		}
		function installPasteInterceptor() {
			document.addEventListener("paste", (event) => {
				const item = Array.from(event.clipboardData?.items ?? []).find((i) => IMAGE_TYPES.has(i.type));
				if (item === void 0) return;
				const file = item.getAsFile();
				if (file === null) return;
				event.preventDefault();
				(async () => {
					const bytes = await file.arrayBuffer();
					const res = await fetch(PASTE_PATH, {
						method: "POST",
						headers: { "content-type": "application/octet-stream" },
						body: bytes
					});
					if (!res.ok) {
						const data = await res.json().catch(() => ({}));
						console.error(`[dsh-eyes] paste failed: ${data.error ?? res.status}`);
						return;
					}
					insertIntoComposer((await res.json()).path);
				})();
			});
		}
		installPasteInterceptor();
		//#endregion
		exports.installPasteInterceptor = installPasteInterceptor;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map