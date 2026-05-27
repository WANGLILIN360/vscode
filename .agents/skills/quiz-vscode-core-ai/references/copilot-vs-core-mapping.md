# Copilot Chat vs VS Code Core Chat — 完整功能对照（深度审计版）

## 对照说明

| 标记 | 含义 |
|---|---|
| [CORE] | VS Code Core `contrib/chat/` 已有，Quiz 直接复用 |
| [COPILOT] | Copilot 扩展独有，Quiz 需要独立实现 |
| [BOTH] | 两者都有，Quiz 需要整合/增强 |

---

## 一、UI 层 (Browser)

### 1.1 Chat 面板 (Panel Chat)

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| ChatWidget 主组件 | [CORE] `browser/widget/chatWidget.ts` | 复用 Core 的 | 直接复用 |
| ChatViewPane 容器 | [CORE] `browser/chatViewPane.ts` | 复用 Core 的 | 直接复用 |
| 消息列表渲染 | [CORE] `browser/widget/chatListWidget.ts` | 复用 Core 的 | 直接复用 |
| Markdown 渲染 | [CORE] `browser/chatContentParts/` | 复用 Core 的 | 直接复用 |
| 代码块渲染 | [CORE] `browser/chatContentParts/` | 复用 Core 的 | 直接复用 |
| 输入框 (Monaco Editor) | [CORE] `browser/chatInputPart.ts` | 复用 Core 的 | 直接复用 |
| 文件附件系统 | [CORE] `browser/attachments/` | 复用 Core 的 | 直接复用 |
| 工具调用渲染 | [CORE] `browser/tools/` | 复用 Core 的 | 直接复用 |
| Session 标签管理 | [CORE] `browser/chatSessions/` | 复用 Core 的 | 直接复用 |
| Mode 选择器 | [CORE] `browser/chatSessions/` | 复用 Core 的 | 直接复用 |
| 编辑 Keep/Undo UI | [CORE] `browser/chatEditing/` | 复用 Core 的 | 直接复用 |
| AI 定制 UI | [CORE] `browser/aiCustomization/` | 复用 Core 的 | 直接复用 |
| **Quiz 品牌样式** | [COPILOT] 无 | Copilot 有品牌 CSS | **Quiz 实现** `browser/media/quiz.css` |
| **Quiz 欢迎页面** | [COPILOT] `getting-started/` | Core 有 `browser/viewsWelcome/` | **Quiz 实现** `browser/welcome/quizWelcomeMessageProvider.ts` |
| **Quiz 状态栏图标** | [COPILOT] 有状态栏 | Core 有 `browser/chatStatus/` | **Quiz 实现** `browser/quizStatusBar.ts` |

### 1.2 Inline Chat

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| InlineChatWidget | [CORE] `inlineChat/browser/` | 复用 Core 的 | 直接复用 |
| **Inline Prompt** | [COPILOT] `extension/prompts/node/inline/` | Core 无 | **Quiz 实现** inline prompt builder |
| **Inline 意图处理** | [COPILOT] `extension/inlineChat/` (7 files) | Core 仅框架 | **Quiz 实现** inline request handler |

### 1.3 Quick Chat / Editor Chat

| 功能 | Core 状态 | Quiz 怎么做 |
|---|---|---|
| Quick Chat Widget | [CORE] | 直接复用 |
| Editor Chat | [CORE] | 直接复用 |

---

## 二、业务逻辑层 (Common)

### 2.1 Chat 服务

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| IChatService | [CORE] | 复用 | 直接复用 |
| **QuizService 核心编排** | 无 | [COPILOT] `extension/conversation/` + `extension/intents/toolCallingLoop.ts` | **Quiz 实现** `common/quizServiceImpl.ts` |
| **Quiz Agent 注册** | 无 | [COPILOT] `extension/conversation/vscode-node/chatParticipants.ts` (17KB) | **Quiz 实现** via IChatSessionsService |

### 2.2 Tool Calling Loop（最关键的缺失）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Tool Calling Loop** | 无 | [COPILOT] `extension/intents/node/toolCallingLoop.ts` **(87KB!)** | **Quiz 实现** `common/agentLoop/quizToolCallingLoop.ts` |
| Tool call limit handling | 无 | [COPILOT] 在 toolCallingLoop 中 | **Quiz 实现** 确认/停止策略 |
| Tool call round tracking | 无 | [COPILOT] IToolCallRound 接口 | **Quiz 实现** |
| Subagent delegation | [CORE] `common/tools/builtinTools/runSubagentTool.ts` (25KB) | 复用 Core 的 | 直接复用 Core 的 RunSubagentTool |
| **Hook execution in loop** | 无 | [COPILOT] toolCallingLoop 中调用 hooks | **Quiz 实现** 在 loop 中集成 hooks |

### 2.3 Chat Hooks System（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Hook Service** | 无 | [COPILOT] `extension/chat/vscode-node/chatHookService.ts` (21KB) | **Quiz 实现** `common/hooks/quizHookService.ts` |
| **Hook Types** | 无 | [COPILOT] `platform/chat/common/chatHookService.ts` (9KB) — SessionStart, PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop | **Quiz 实现** hook type 定义 |
| **Hook Executor** | 无 | [COPILOT] `platform/chat/common/hookExecutor.ts` (1.7KB) | **Quiz 实现** hook 执行器 |
| **Hook Command Types** | 无 | [COPILOT] `platform/chat/common/hookCommandTypes.ts` (1.7KB) | **Quiz 实现** |
| **Hook Telemetry** | 无 | [COPILOT] `extension/chat/vscode-node/chatHookTelemetry.ts` (4.8KB) | **Quiz 实现** |

### 2.4 Session Transcript（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Session Transcript Service** | 无 | [COPILOT] `extension/chat/vscode-node/sessionTranscriptService.ts` (11KB) | **Quiz 实现** `common/session/quizSessionTranscript.ts` |
| **Transcript Types** | 无 | [COPILOT] `platform/chat/common/sessionTranscriptService.ts` (8KB) — IHistoricalTurn, ToolRequest, IToolCallRound | **Quiz 实现** |
| **Chat History Builder** | 无 | [COPILOT] `extension/chatSessions/vscode-node/chatHistoryBuilder.ts` (19KB) | **Quiz 实现** `common/session/quizChatHistoryBuilder.ts` |

### 2.5 Checkpoint / Worktree（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Worktree Service** | 无 | [COPILOT] `chatSessionWorktreeServiceImpl.ts` (38KB) | **Quiz 实现** `electron-browser/checkpoint/quizCheckpointServiceImpl.ts` |
| **Checkpoint Service** | 无 | [COPILOT] `chatSessionWorktreeCheckpointServiceImpl.ts` (11KB) | **Quiz 实现** `common/checkpoint/quizCheckpointService.ts` |
| **External Edit Tracker** | 无 | [COPILOT] `chatSessions/common/externalEditTracker.ts` (3.2KB) | **Quiz 实现** |

### 2.6 Session Metadata（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Metadata Store** | 无 | [COPILOT] `chatSessionMetadataStoreImpl.ts` (19KB) | **Quiz 实现** `common/session/quizSessionMetadataStore.ts` |
| **Workspace Folder Service** | 无 | [COPILOT] `chatSessionWorkspaceFolderServiceImpl.ts` (8KB) | **Quiz 实现** |
| **Repository Tracker** | 无 | [COPILOT] `chatSessionRepositoryTracker.ts` (6KB) | **Quiz 实现** |

### 2.7 Feedback & Reporting（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Feedback Collection** | 无 | [COPILOT] `feedbackCollection.ts` (4KB) | **Quiz 实现** `browser/feedback/quizFeedbackService.ts` |
| **Feedback Reporter** | 无 | [COPILOT] `feedbackReporter.ts` (12KB) | **Quiz 实现** |
| **Feedback Contribution** | 无 | [COPILOT] `feedbackContribution.ts` (1.9KB) | **Quiz 实现** |
| **User Actions Service** | 无 | [COPILOT] `userActions.ts` (33KB) — handles thumbs up/down, issue reporting | **Quiz 实现** |

### 2.8 Language Model Access（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **LM Access** | 无 | [COPILOT] `languageModelAccess.ts` (37KB) — model capabilities, reasoning effort, rate limits | **Quiz 实现** `common/modelAccess/quizModelAccessService.ts` |
| **LM Access Prompt** | 无 | [COPILOT] `languageModelAccessPrompt.tsx` (4.5KB) — TSX prompt for model selection | **Quiz 实现** 纯 TS 版本 |
| **Chat Quota Service** | 无 | [COPILOT] `chatQuotaService.ts` + `chatQuotaServiceImpl.ts` | **Quiz 实现** 简化版 |
| **Model Configuration Schema** | 无 | [COPILOT] `languageModelAccess.ts` 中 buildConfigurationSchema() — reasoning effort picker | **Quiz 实现** |

### 2.9 Debug / Request Logging（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Debug File Logger** | 无 | [COPILOT] `chatDebugFileLoggerService.ts` (52KB!) | **Quiz 实现** 简化版 `common/debug/quizDebugLogger.ts` |
| **Request Logger** | 无 | [COPILOT] `requestLoggerImpl.ts` (29KB) | **Quiz 实现** 简化版 |
| **Request Log Tree** | 无 | [COPILOT] `log/vscode-node/requestLogTree.ts` | **Quiz 可选** |

### 2.10 Customization Sync（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Customization Harness** | [CORE] `ICustomizationHarnessService` | Copilot uses it | **Quiz 必须** `registerExternalHarness()` |
| **Sync Provider** | 无 | [COPILOT] `AgentCustomizationSyncProvider` | **Quiz 实现** `browser/customization/quizCustomizationSyncProvider.ts` |
| **Item Provider** | 无 | [COPILOT] `AgentCustomizationItemProvider` | **Quiz 实现** `browser/customization/quizCustomizationItemProvider.ts` |
| **Bundler** | 无 | [COPILOT] `SyncedCustomizationBundler` | **Quiz 实现** |

### 2.11 External Path Confirmation（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **External Path Confirmation** | [CORE] `chatExternalPathConfirmation.ts` (10KB) | Copilot 复用 Core 的 | **Quiz 复用** Core 的 `ChatExternalPathConfirmationContribution`，注册到 `quiz_readFile` 和 `quiz_listDir` |

### 2.12 Title Provider（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Title Provider** | 无 | [COPILOT] `prompt/node/title.ts` (3.3KB) — auto-generate session titles | **Quiz 实现** `browser/prompt/quizTitleProvider.ts` |

### 2.13 Terminal Fix Generator（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Terminal Fix** | 无 | [COPILOT] `terminalFixGenerator.ts` (10KB) — suggest fixes for failed terminal commands | **Quiz 实现** `browser/terminal/quizTerminalFixGenerator.ts` |

### 2.14 Workspace Recorder / Semantic Search（可选高级）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| Workspace Recorder | 无 | [COPILOT] `workspaceRecorder/` (8 files) | **Quiz 可选** |
| Semantic Search | 无 | [COPILOT] `workspaceSemanticSearch/` (3 files) | **Quiz 可选** |
| Chunk Search | 无 | [COPILOT] `workspaceChunkSearch/` (3 files) | **Quiz 可选** |
| TF-IDF Search | 无 | [COPILOT] `platform/tfidf/` (4 files) | **Quiz 可选** |
| Embeddings | 无 | [COPILOT] `platform/embeddings/` (8 files) | **Quiz 可选** |

### 2.15 BYOK (Bring Your Own Key)（可选高级）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **BYOK Provider** | 无 | [COPILOT] `byok/` (27 files) — support for custom API keys and endpoints | **Quiz 可选** |

### 2.16 Inline Edits / NES（可选高级）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| Inline Edits | [CORE] `contrib/inlineEdits/` | [COPILOT] `extension/inlineEdits/` (71 files) | **Quiz 可选** — Core 已有框架 |
| Completions | [CORE] `contrib/inlineCompletions/` | [COPILOT] `extension/completions-core/` (352 files!) | **Quiz 可选** — 巨大工程 |

### 2.17 MCP Integration（新发现）

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| MCP Server | [CORE] `contrib/mcp/` | [COPILOT] `extension/mcp/` (21 files) | **Quiz 复用** Core 的 MCP 基础设施 |

### 2.18 GitHub-Specific（不需要）

| 功能 | 说明 |
|---|---|
| `extension/githubMcp/` | GitHub MCP — Quiz 不需要 |
| `extension/git/` | Git 集成 — Quiz 复用 Core 的 |
| `extension/review/` | PR Review — Quiz 不需要 |
| `extension/externalAgents/` | External agent hosting — Quiz 不需要 |
| `extension/xtab/` | XTab — Quiz 不需要 |
| `extension/power/` | Power mode — Quiz 不需要 |
| `extension/survey/` | Survey — Quiz 不需要 |
| `extension/onboardDebug/` | Onboard debug — Quiz 不需要 |

---

## 三、工具系统对照

### Core 已有的内置工具（Quiz 可复用）

| 工具 | Core 位置 | 说明 |
|------|----------|------|
| EditTool | `chat/common/tools/builtinTools/editFileTool.ts` | 文件编辑 |
| AskQuestionsTool | `chat/common/tools/builtinTools/askQuestionsTool.ts` (27KB) | 交互式提问 |
| ConfirmationTool | `chat/common/tools/builtinTools/confirmationTool.ts` | 确认 |
| ManageTodoListTool | `chat/common/tools/builtinTools/manageTodoListTool.ts` (14KB) | Todo 管理 |
| ReviewPlanTool | `chat/common/tools/builtinTools/reviewPlanTool.ts` | 计划审查 |
| RunSubagentTool | `chat/common/tools/builtinTools/runSubagentTool.ts` (25KB) | 子 agent |
| TaskCompleteTool | `chat/common/tools/builtinTools/taskCompleteTool.ts` | 任务完成 |
| SetArtifactsTool | `chat/common/tools/builtinTools/setArtifactsTool.ts` | Artifacts |
| FetchWebPageTool | `chat/electron-browser/builtInTools/fetchPageTool.ts` (15KB) | 网页抓取 |

### Copilot 独有的工具（Quiz 需要实现）

| 工具 | Copilot 位置 | Quiz 需要 |
|------|-------------|----------|
| readFile | `extension/tools/node/readFileTool.tsx` (22KB) | **是** — electron-browser |
| listDir | `extension/tools/node/` | **是** — electron-browser |
| editFile (advanced) | `extension/tools/node/editFileToolUtils.tsx` (35KB) | **是** — 包含 healing 逻辑 |
| applyPatch | `extension/tools/node/applyPatch/` (41KB) | **是** — electron-browser |
| terminal | `extension/tools/node/` | **是** — electron-browser |
| findFiles | `extension/tools/node/` | **是** — electron-browser |
| findTextInFiles | `extension/tools/node/` | **是** — electron-browser |
| codebase | `extension/tools/node/codebaseTool.tsx` (9KB) | **是** — 语义搜索 |
| memory | `extension/tools/node/memoryTool.tsx` (34KB) | **是** |
| searchSubagent | `extension/tools/node/` | **是** |
| executionSubagent | `extension/tools/node/` | **是** |
| testFailure | `extension/tools/node/` | **是** |
| createFile / createDirectory | `extension/tools/node/` | **是** |

### Quiz 专用工具（Copilot 没有）

| 工具 | 说明 |
|------|------|
| generateQuestions | 生成测验题目 |
| evaluateAnswer | 评估答案 |
| trackProgress | 学习进度追踪 |
| searchKnowledgeBase | 知识库搜索 |
| switchAgent | 切换 Agent 模式 |

---

## 四、Prompt 系统对照

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| Prompt 渲染引擎 | **无** (`@vscode/prompt-tsx` 是 npm 包) | [COPILOT] 86 个文件使用 | **Quiz 纯 TS prompt builder** |
| Agent Prompt | 无 | [COPILOT] `extension/prompts/node/agent/` (784 prompt files!) | **Quiz 实现** 精简版 |
| Panel Prompt | 无 | [COPILOT] `extension/prompts/node/panel/` | **Quiz 实现** |
| Inline Prompt | 无 | [COPILOT] `extension/prompts/node/inline/` | **Quiz 实现** |
| Prompt Registry | 无 | [COPILOT] `extension/prompts/node/agent/promptRegistry.ts` | **Quiz 实现** 模型路由 |
| Summarizer | 无 | [COPILOT] `extension/prompt/node/summarizer.ts` | **Quiz 实现** |
| Intent Detection | 无 | [COPILOT] `extension/prompt/node/intentDetector.tsx` (28KB) | **Quiz 实现** |

---

## 五、认证与配置

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| Auth API | [CORE] `platform/authentication/` | 复用 | 直接复用 |
| **Quiz Auth** | 无 | [COPILOT] `platform/authentication/` (15 files) | **Quiz 实现** `common/auth/` |
| **GitHub OAuth** | 无 | [COPILOT] `platform/github/` | **Quiz 实现** |
| **Token Refresh** | 无 | [COPILOT] `copilotTokenManager.ts` + `copilotTokenStore.ts` | **Quiz 实现** |
| **Custom Instructions** | [CORE] `common/customInstructions` | 复用 | 直接复用 |

---

## 六、Telemetry

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| Telemetry Service | [CORE] `platform/telemetry/` | 复用 | 直接复用 |
| **Quiz Telemetry** | 无 | [COPILOT] `platform/otel/` (31 files) + `platform/telemetry/` (20 files) | **Quiz 实现** 简化版 |
| **OTel Integration** | 无 | [COPILOT] `platform/otel/` — OpenTelemetry spans | **Quiz 可选** |

---

## 总结：Quiz 需要独立实现的模块（按优先级排序）

### P0 — 必须实现（没有这些系统无法运行）

1. **`common/agentLoop/quizToolCallingLoop.ts`** — 核心 agent 循环（Copilot 87KB）
2. **`common/quizServiceImpl.ts`** — 请求编排
3. **`common/session/quizSessionTranscript.ts`** — 对话记录
4. **`common/session/quizChatHistoryBuilder.ts`** — 记录→消息转换
5. **`browser/endpoint/`** — AI 后端通信（4 files）
6. **`browser/parser/`** — 响应解析（2 files）
7. **`browser/prompt/`** — Prompt 构建（6 files）
8. **`common/endpoint/`** — Endpoint 接口（3 files）
9. **`common/auth/`** — 认证接口（1 file）
10. **`browser/auth/`** — 认证实现（1 file）
11. **`browser/quiz.contribution.ts`** — 注册入口
12. **`common/constants.ts`** + **`quizTypes.ts`** + **`quizConfiguration.ts`** + **`quizToolIds.ts`** + **`quizLanguageModels.ts`**

### P1 — 重要实现（没有这些功能不完整）

13. **`common/hooks/quizHookService.ts`** — Hook 系统
14. **`browser/hooks/quizHookServiceImpl.ts`** — Hook 实现
15. **`common/checkpoint/quizCheckpointService.ts`** — 编辑撤销
16. **`electron-browser/checkpoint/quizCheckpointServiceImpl.ts`** — Git worktree
17. **`common/session/quizSessionMetadataStore.ts`** — 会话持久化
18. **`browser/customization/`** — 定制同步（2 files）
19. **`browser/feedback/quizFeedbackService.ts`** — 反馈收集
20. **`browser/welcome/quizWelcomeMessageProvider.ts`** — 欢迎消息
21. **`browser/prompt/quizTitleProvider.ts`** — 自动标题
22. **`common/modelAccess/quizModelAccessService.ts`** — 模型能力检测
23. **`electron-browser/confirmation/quizExternalPathConfirmation.ts`** — 外部路径确认
24. **`browser/terminal/quizTerminalFixGenerator.ts`** — 终端修复建议

### P2 — 必须实现（高级功能，全部必须）

25. **`common/debug/quizDebugLogger.ts`** + **`quizRequestLogger.ts`** — 调试日志 + 请求关联
26. **`common/byok/`** — BYOK 支持（Anthropic/Azure/Gemini/Ollama/OpenAI/OpenRouter/xAI 7 个 provider + 3 个消息转换器）
27. **`common/embeddings/`** — 向量嵌入（Computer/Index/Grouper/Storage/Remote 5 个接口）
28. **`common/semanticSearch/`** — 语义搜索（Service + CombinedRank + TextSearchProvider）
29. **`common/workspaceSearch/`** — 工作区块搜索（ChunkSearch + IndexingStatus + Commands）
30. **`common/workspaceRecorder/`** — 工作区变更记录（Recorder + ListenerService + SafeFileWrite）
31. **`common/inlineEdits/`** — 行内编辑建议（InlineEditService + Widget）
32. **`common/completions/`** — 代码补全（CompletionService + CompletionTypes）
33. **`common/customization/`** — 定制同步（SyncProvider + ItemProvider + Bundler）
34. **`electron-browser/confirmation/quizExternalPathConfirmation.ts`** — 外部路径确认

### 直接复用 Core 的

- ChatWidget, ChatInputPart, ChatListWidget, ChatViewPane
- ChatEditing (Keep/Undo)
- ChatSessions (session 管理 UI)
- Attachments (附件系统)
- Accessibility (无障碍)
- ChatService, ChatModel
- ChatAgents (agent 注册接口)
- LanguageModelToolsService (工具基础设施)
- LanguageModelsService (模型注册)
- InlineChat (内联聊天)
- InlineCompletions (行内补全)
- InlineEdits (NES)
- MCP (Model Context Protocol)
- BuiltinTools (EditTool, AskQuestionsTool, ConfirmationTool, ManageTodoListTool, RunSubagentTool, FetchWebPageTool)

---

## 七、第三轮深度审计新发现（2025-05）

### 7.1 Thinking/Reasoning Data System

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Thinking Data 接口** | 无 | [COPILOT] `platform/thinking/common/thinking.ts` + `thinkingUtils.ts` | **Quiz 实现** `common/agentLoop/quizThinkingData.ts` |
| **ThinkingDataItem** | 无 | [COPILOT] `prompt/common/toolCallRound.ts#ThinkingDataItem` — 流式 delta 累积, 加密思考块 | **Quiz 实现** `QuizThinkingDataItem` — 同样的 delta 累积逻辑 |
| **Thinking in Prompt** | 无 | [COPILOT] `platform/endpoint/common/thinkingDataContainer.tsx` — enableThinking, reasoningEffort | **Quiz 实现** `common/prompt/quizThinkingPromptHandler.ts` — 纯 TS 版本 |

### 7.2 ToolCallRound 完整字段

| 字段 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| `response` | 无 | [COPILOT] 本轮助手文本回复 | **Quiz 添加** 到 `IQuizToolCallRound` |
| `toolInputRetry` | 无 | [COPILOT] 工具输入验证失败重试次数 | **Quiz 添加** |
| `statefulMarker` | 无 | [COPILOT] OpenAI Responses API 多轮状态追踪 | **Quiz 添加** |
| `compaction` | 无 | [COPILOT] `OpenAIContextManagementResponse` 上下文压缩 | **Quiz 添加** `IQuizCompactionData` |
| `thinking` | 无 | [COPILOT] `ThinkingData` 推理数据 | **Quiz 添加** |
| `phase` / `phaseModelId` | 无 | [COPILOT] 多阶段 agent（planning→executing） | **Quiz 添加** |
| `summary` | 无 | [COPILOT] 本轮摘要（compaction 后恢复上下文） | **Quiz 添加** |
| `cachedTokens` | 无 | [COPILOT] prompt caching 命中数 | **Quiz 添加** 到 `IQuizTokenUsage` |

### 7.3 Special Request Types

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Tool Call Limit Extension** | 无 | [COPILOT] `IToolCallIterationIncrease` — 达到上限时询问是否继续 | **Quiz 实现** `common/agentLoop/quizSpecialRequestTypes.ts` |
| **Continue On Error** | 无 | [COPILOT] `IContinueOnErrorConfirmation` — 工具出错时继续而非终止 | **Quiz 实现** |
| **Switch To Auto On Rate Limit** | 无 | [COPILOT] `ISwitchToAutoOnRateLimitConfirmation` — rate limit 时自动切换 | **Quiz 实现** |

### 7.4 Turn Status & Message Types

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **TurnStatus 完整枚举** | 无 | [COPILOT] InProgress, Success, Cancelled, **OffTopic**, **Filtered**, **PromptFiltered**, Error | **Quiz 添加** OffTopic, Filtered, PromptFiltered |
| **TurnMessage 类型** | 无 | [COPILOT] user, follow-up, template, offtopic-detection, model, meta, server | **Quiz 实现** `QuizTurnMessage` |
| **RequestDebugInformation** | 无 | [COPILOT] `prompt/common/conversation.ts` — URI + intentId + toolCallRounds | **Quiz 实现** `QuizRequestDebugInformation` |

### 7.5 Chat Permission System

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Permission Level** | [CORE] `ChatPermissionLevel` context key | 复用 Core | **Quiz 实现** `QuizPermissionLevel` (Default, FullAuto) |
| **Permission Warnings** | [CORE] `chat/common/chatPermissionWarnings.ts` (5.6KB) | 复用 Core | **Quiz 复用** Core 的警告机制 |
| **Permission Storage Keys** | [CORE] `chat/common/chatPermissionStorageKeys.ts` | 复用 Core | **Quiz 复用** |
| **Tool Permission Category** | 无 | [COPILOT] tools 分 safe/destructive/external | **Quiz 实现** `QuizToolPermissionCategory` + `QuizToolPermissionMap` |

### 7.6 Streaming Grammar

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Streaming Grammar** | 无 | [COPILOT] `prompt/common/streamingGrammar.ts` — 状态机解析流式输出 | **Quiz 实现** `common/parser/quizStreamingGrammar.ts` |

### 7.7 Chat Modes Integration

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **IChatModeService** | [CORE] `chat/common/chatModes.ts` (27KB) | 复用 Core | **Quiz 注册** 5 种模式 via `registerMode()` |
| **Mode Registration** | [CORE] `registerMode()` API | 复用 Core | **Quiz 实现** `browser/quizChatModes.contribution.ts` |

### 7.8 Agent Host Session Handler

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Session Handler** | [CORE] `agentHostSessionHandler.ts` (122KB) | Copilot 用 extension API | **Quiz 自实现** `browser/quizSessionHandler.ts` 遵循 Core 模式 |
| **State → Progress** | [CORE] `stateToProgressAdapter.ts` (43KB) | 复用 Core | **Quiz 自实现** `browser/quizStateToProgressAdapter.ts` |
| **Agent Host 子系统** | [CORE] 22 个文件 | 部分复用 | **Quiz 复用 12 个, 自实现 6 个, 不需要 1 个**（详见 quiz-vscode-core-ai SKILL.md） |

### 7.9 Core Debug Service

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **IChatDebugService** | [CORE] `chat/common/chatDebugService.ts` (13KB) + impl (19KB) | Copilot 有自己的 debug file logger | **Quiz 集成** Core 的 `IChatDebugService`（而非独立实现） |
| **Chat Debug Events** | [CORE] `chat/common/chatDebugEvents.ts` (6KB) | — | **Quiz 复用** Core 的事件类型 |

### 7.10 Tool Result Compressor

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Tool Result Compressor** | [CORE] `chat/common/tools/toolResultCompressor.ts` (5.6KB) | 复用 Core | **Quiz 可复用** Core 的，或自实现简化版 `common/tools/quizToolResultCompressor.ts` |

### 7.11 URL Fetching Confirmation

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **URL Fetching Confirmation** | [CORE] `chat/common/tools/builtinTools/chatUrlFetchingConfirmation.ts` (11.6KB) | 复用 Core | **Quiz 复用** Core 的 `ChatUrlFetchingConfirmationContribution`，注册到 `quiz_fetchWebPage` |
| **URL Fetching Patterns** | [CORE] `chat/common/tools/builtinTools/chatUrlFetchingPatterns.ts` (5.5KB) | 复用 Core | **Quiz 复用** |

### 7.12 Prompt Categorization Taxonomy

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Intent Taxonomy** | 无 | [COPILOT] `prompt/common/promptCategorizationTaxonomy.ts` (21KB) — 15+ 意图分类 | **Quiz 扩展** 15 通用意图 + 4 Quiz 特有意图 (challenge, evaluate, teach, track_progress) |
| **Intent → Mode Map** | 无 | [COPILOT] 隐含在 agent 配置中 | **Quiz 显式** `QUIZ_INTENT_MODE_MAP` |

### 7.13 Context Providers

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Language Context** | 无 | [COPILOT] `extension/languageContextProvider/vscode-node/` (5.4KB) | **Quiz 实现** `electron-browser/contextResolvers/quizLanguageContextProviderService.ts` |
| **Diagnostics Context** | 无 | [COPILOT] `extension/diagnosticsContext/vscode/` (6.8KB) | **Quiz 实现** `browser/contextResolvers/quizDiagnosticsContextProviderService.ts` |
| **Chat Session Context** | 无 | [COPILOT] `extension/chatSessionContext/vscode-node/` (10.5KB) | **Quiz 实现** — 已在 session management 中覆盖 |

### 7.14 其他 Copilot 平台服务

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Blocked Extension** | 无 | [COPILOT] `platform/chat/common/blockedExtensionService.ts` | **Quiz 实现** `common/quizBlockedExtensionService.ts` |
| **Interaction Service** | 无 | [COPILOT] `platform/chat/common/interactionService.ts` — telemetry 交互追踪 | **Quiz 实现** `common/quizInteractionService.ts` |
| **Configuration Migration** | 无 | [COPILOT] `extension/configuration/vscode-node/configurationMigration.ts` (6.5KB) | **Quiz 实现** `browser/quizConfigurationMigration.ts` |

### 7.15 Context Keys

| 功能 | Core 状态 | Copilot 状态 | Quiz 怎么做 |
|---|---|---|---|
| **Chat Context Keys** | [CORE] `chat/common/actions/chatContextKeys.ts` — 30+ keys | 复用 Core | **Quiz 注册** 25+ Quiz 前缀 context keys `browser/contextKeys/quizContextKeys.contribution.ts` |

### 7.16 Core UI 集成点

| 功能 | Core 状态 | Quiz 怎么做 |
|---|---|---|
| **Chat Image Extraction** | [CORE] `chat/common/chatImageExtraction.ts` (8.7KB) | **Quiz 复用** Core 的图片附件处理 |
| **Chat Perf** | [CORE] `chat/common/chatPerf.ts` (4KB) | **Quiz 添加** perf marker |
| **Chat Enablement** | [CORE] `chat/common/enablement.ts` (5.1KB) | **Quiz 注册** enablement 条件 |
| **Voice Chat** | [CORE] `chat/common/voiceChatService.ts` (9.4KB) | **Quiz 复用** Core 的语音输入 |
| **AI Customization Workspace** | [CORE] `chat/common/aiCustomizationWorkspaceService.ts` (7.5KB) | **Quiz 通过** `ICustomizationHarnessService` 接入 |
| **Chat Editing Notebook** | [CORE] `chatEditing/notebook/` (9 items) | **Quiz 复用** Core 的 notebook 编辑 |
| **Chat Editing Checkpoint Timeline** | [CORE] `chatEditing/chatEditingCheckpointTimeline*.ts` (39KB) | **Quiz 复用** Core 的时间线 UI |
| **Chat Editing Editor Overlay** | [CORE] `chatEditing/chatEditingEditorOverlay.ts` (15KB) | **Quiz 复用** Core 的编辑器覆盖层 |
| **Chat Editing Explanation** | [CORE] `chatEditing/chatEditingExplanationWidget.ts` (22KB) | **Quiz 复用** Core 的编辑解释 UI |
| **Language Model Stats** | [CORE] `chat/common/languageModelStats.ts` (2.7KB) | **Quiz 通过** `ILanguageModelStatsService` 上报 |
| **Working Directory** | [CORE] `chat/common/workingDirectory.ts` (2.2KB) | **Quiz 设置** 工作目录上下文 |
| **Chat Todo List** | [CORE] `chat/common/tools/chatTodoListService.ts` (4KB) | **Quiz 复用** Core 的 Todo 列表 |
| **Chat Artifact System** | [CORE] `chat/common/chatArtifactExtraction.ts` + `chatArtifactsService.ts` | **Quiz 复用** Core 的 Artifact 系统 |

---

## 总结更新：Quiz 需要独立实现的模块（含第三轮审计）

### P0 — 必须实现

1. `common/agentLoop/quizToolCallingLoop.ts` — 核心 agent 循环
2. `common/quizServiceImpl.ts` — 请求编排
3. `common/session/quizSessionTranscript.ts` — 对话记录
4. `common/session/quizChatHistoryBuilder.ts` — 记录→消息转换
5. `browser/endpoint/` — AI 后端通信（4 files）
6. `browser/parser/quizStreamingGrammar.ts` — **新增** 流式响应状态机
7. `browser/prompt/` — Prompt 构建（6 files）
8. `common/endpoint/` — Endpoint 接口（3 files）
9. `common/auth/` — 认证接口（1 file）
10. `browser/auth/` — 认证实现（1 file）
11. `browser/quiz.contribution.ts` — 注册入口
12. `common/constants.ts` + `quizTypes.ts` + `quizConfiguration.ts` + `quizToolIds.ts` + `quizLanguageModels.ts`
13. `common/agentLoop/quizThinkingData.ts` — **新增** Thinking/Reasoning 数据
14. `common/agentLoop/quizSpecialRequestTypes.ts` — **新增** 特殊确认流程
15. `common/agentLoop/quizTurnStatus.ts` — **新增** TurnStatus + TurnMessage
16. `common/agents/quizChatPermissionService.ts` — **新增** 权限系统
17. `browser/quizSessionHandler.ts` — **新增** IChatSession 实现
18. `browser/quizStateToProgressAdapter.ts` — **新增** 状态→Progress 转换

### P1 — 重要实现

19. `common/hooks/quizHookService.ts` — Hook 系统
20. `browser/hooks/quizHookServiceImpl.ts` — Hook 实现
21. `common/checkpoint/quizCheckpointService.ts` — 编辑撤销
22. `electron-browser/checkpoint/quizCheckpointServiceImpl.ts` — Git worktree
23. `common/session/quizSessionMetadataStore.ts` — 会话持久化
24. `browser/customization/` — 定制同步（2 files）
25. `browser/feedback/quizFeedbackService.ts` — 反馈收集
26. `browser/welcome/quizWelcomeMessageProvider.ts` — 欢迎消息
27. `browser/prompt/quizTitleProvider.ts` — 自动标题
28. `common/modelAccess/quizModelAccessService.ts` — 模型能力检测
29. `electron-browser/confirmation/quizExternalPathConfirmation.ts` — 外部路径确认
30. `browser/terminal/quizTerminalFixGenerator.ts` — 终端修复建议
31. `common/tools/quizToolResultCompressor.ts` — **新增** 工具结果压缩
32. `electron-browser/confirmation/quizUrlFetchingConfirmation.ts` — **新增** URL 抓取确认
33. `common/prompt/quizThinkingPromptHandler.ts` — **新增** Prompt thinking 处理
34. `common/prompt/quizPromptCategorizationTaxonomy.ts` — **新增** 意图分类法
35. `browser/quizDebugIntegration.ts` — **新增** Core Debug Service 集成
36. `browser/quizChatModes.contribution.ts` — **新增** Chat Modes 注册
37. `browser/contextKeys/quizContextKeys.contribution.ts` — **新增** Context Keys

### P2 — 高级功能

38. `common/debug/quizDebugLogger.ts` + `quizRequestLogger.ts` — 调试日志
39. `common/byok/` — BYOK 支持（7 providers + 3 converters）
40. `common/embeddings/` — 向量嵌入（5 interfaces）
41. `common/semanticSearch/` — 语义搜索
42. `common/workspaceSearch/` — 工作区块搜索
43. `common/workspaceRecorder/` — 工作区变更记录
44. `common/inlineEdits/` — 行内编辑建议
45. `common/completions/` — 代码补全
46. `common/customization/` — 定制同步
47. `browser/quizConfigurationMigration.ts` — **新增** 设置迁移
48. `electron-browser/contextResolvers/quizLanguageContextProviderService.ts` — **新增** 语言上下文
49. `browser/contextResolvers/quizDiagnosticsContextProviderService.ts` — **新增** 诊断上下文
50. `common/quizBlockedExtensionService.ts` — **新增** 扩展屏蔽
51. `common/quizInteractionService.ts` — **新增** 交互追踪

### 文件总数：212 (原始) + 122 (第二轮) + 19 (第三轮) = **353 files**
