# dsh-eyes — DSH 视觉理解插件

给 DeepSeek Harness 装上眼睛：通过 **zai glm-4.6v-flash**（限流自动降级 **glm-4v-flash**）把图片读成结构化 JSON 证据（OCR / 版面 / 语义 / 视觉 / 不确定项），让纯文本模型也能"看"图并引用证据而非猜测。

学习自 [modlens](https://github.com/liustack/modlens) 的设计，但视觉引擎换成你自己的 zai 账号（`ZAI_API_KEY`），不依赖任何外部 CLI。

## 功能

- **原生工具 `dsh-eyes`**：模型每次请求都能看到工具 schema，传图片路径/URL 即可读图
- **结构化输出**：6 段 JSON（`summary` / `ocr` / `layout` / `semantics` / `visual` / `uncertainty`），模型引用具体证据
- **双模型降级**：`glm-4.6v-flash` 主引擎，429/失败自动降级 `glm-4v-flash`
- **粘贴图片**（web profile）：浏览器端拦截图片粘贴 → 自动转临时文件路径 → 模型读

## 环境要求

- DeepSeek Harness（dsh），Node.js ≥ 22.19
- `ZAI_API_KEY`（zai / 智谱开放平台 API key）——设置环境变量，或写入 `~/.dsh/.credentials.yaml`：
  ```yaml
  ZAI_API_KEY: your-key-here
  ```

## 安装

从 npm 安装（发布后）：

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-eyes
npx -y @deepseek-ai/dsh plugin --profile desktop add dsh-eyes
```

从源码安装（开发模式）：

```bash
git clone https://github.com/RICHES-code/dsh-eyes
cd dsh-eyes
pnpm install
pnpm run build        # tsc + tsdown，产出 lib/（host + client 双面）

# 装进你的 profile
npx -y @deepseek-ai/dsh plugin --profile web add "file:$(pwd)"
npx -y @deepseek-ai/dsh plugin --profile desktop add "file:$(pwd)"
```

> 仓库已包含构建产物（`lib/` 已提交），克隆后**无需构建**即可安装：
> ```bash
> git clone https://github.com/RICHES-code/dsh-eyes
> cd dsh-eyes
> npx -y @deepseek-ai/dsh plugin --profile web add "file:$(pwd)"
> ```
> 只有修改源码后才需要重新 `pnpm install && pnpm run build`。

## 使用

安装后正常聊天即可：

- **给路径**：`帮我看看这张图 E:\截图.png` —— 模型会调用 `dsh-eyes` 工具读图
- **粘贴图片**（web profile）：直接 Ctrl+V 粘贴截图，自动转路径进输入框
- **给 URL**：`读一下这张图 https://example.com/x.png`

模型返回的是结构化证据（逐字 OCR、阅读顺序版面、实体关系、不确定项），你可以让它"引用图中的证据"。

## 工具参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `path` | string | ✅ | 本地绝对路径或 http(s) 图片 URL |
| `prompt` | string | — | 可选额外关注点，如 "focus on the axis labels" |

## 输出 JSON Schema（6 段）

```json
{
  "summary": "整体一句话总结",
  "ocr": { "full_text": "逐字转写", "lines": [{"text": "...", "language": "zh"}] },
  "layout": { "regions": [{"type": "title|paragraph|table|...", "reading_order": 1, "text": "..."}] },
  "semantics": { "scene": "...", "entities": [{"name": "...", "type": "...", "evidence": "..."}], "relations": [{"subject": "...", "predicate": "...", "object": "..."}] },
  "visual": { "dominant_colors": ["#fff"], "style": "...", "notes": ["..."] },
  "uncertainty": ["无法确定的内容"]
}
```

## 开发

```bash
pnpm install
pnpm exec vitest run tests/    # 单测
pnpm run build                 # 构建 lib/
```

## License

MIT
