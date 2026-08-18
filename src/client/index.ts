/**
 * dsh-eyes browser half: intercepts image pastes and routes the bytes to the
 * host /vision/paste route, returning a temp file path the model can read via
 * the dsh-eyes tool.
 * @module @deepseek-ai/dsh-eyes/client
 */

const PASTE_PATH = '/vision/paste'
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function insertIntoComposer(text: string): void {
  // The web shell mounts a contenteditable composer; dispatch a paste-shaped
  // text insertion. Falls back to a console hint when no composer is found.
  const composer = document.querySelector('[contenteditable="true"]') as HTMLElement | null
  if (composer === null) {
    console.warn(`[dsh-eyes] no composer found; paste path: ${text}`)
    return
  }
  composer.focus()
  const selection = window.getSelection()
  if (selection === null) return
  selection.selectAllChildren(composer)
  selection.collapseToEnd()
  document.execCommand('insertText', false, ` ${text} `)
}

export function installPasteInterceptor(): void {
  document.addEventListener('paste', (event) => {
    const item = Array.from(event.clipboardData?.items ?? []).find(i => IMAGE_TYPES.has(i.type))
    if (item === undefined) return
    const file = item.getAsFile()
    if (file === null) return
    event.preventDefault()
    void (async () => {
      const bytes = await file.arrayBuffer()
      const res = await fetch(PASTE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        console.error(`[dsh-eyes] paste failed: ${data.error ?? res.status}`)
        return
      }
      const data = await res.json() as { path: string }
      insertIntoComposer(data.path)
    })()
  })
}

installPasteInterceptor()
