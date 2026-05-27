common/          ← 纯类型、接口，无 DI、无平台 API
browser/         ← Renderer 进程，用 DI 服务（IFileService 等），无 Node API
electron-browser/← Electron renderer 特有接线：registerSingleton + IPC channel 注册
node/            ← Extension Host 进程，可用 Node API（fs, child_process, http）
VS Code Core 的层规则（从 @e:\vscode-main\build\checker\layersChecker.ts 确认）：

common/ — 禁止 NATIVE_TYPES，无 DI
browser/ — 禁止 NATIVE_TYPES，DI 服务 + UI + 命令全部放这里
electron-browser/ — 可用 native 类型，覆盖 browser 的 registerSingleton
node/ — 可用 fs/child_process 等
。


让我先梳理 Quiz 现有的模块和 Copilot 的完整依赖链。



从现有代码的模式来看：

IQuiz 前缀 — 接口 (Interface)
用于纯接口类型，表示"契约"，没有实现：

IQuizWorkingSetEntry — union type
IQuizBuildPromptContext — 接口
IQuizIntent — 接口
IQuizRange — 接口
IQuizTextDocumentSnapshotJSON — JSON 序列化接口
IQuizIntentService — 服务标识接口
Quiz 前缀 — 类/枚举/具体实现
用于有运行时存在的类型（class、enum、const、function）：

QuizTextDocumentSnapshot — class（有构造函数、方法实现）
QuizNotebookDocumentSnapshot — class
QuizWorkingSetEntryState — enum
QuizIntent — const enum
QuizNullIntentInvocation — class
QuizIntentError — class
QuizChatVariablesCollection — class
规则总结
类型	前缀	示例
interface	IQuiz	IQuizRange, IQuizIntent
class	Quiz	QuizTextDocumentSnapshot
enum / const enum	Quiz	QuizIntent, QuizWorkingSetEntryState
type alias	IQuiz	IQuizWorkingSet
function	quiz (小写)	getQuizToolName, isQuizTextDocument...
const	quiz (小写)	quizToolCategories

## 完整实现 Intent 需要的模块依赖层次

从**最底层（被依赖、不依赖别人）**到**最顶层（依赖所有下层）**：

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Intent 实现层 (最顶层)                          │
│   quizAgentIntent / quizEditIntent / quizAskAgentIntent  │
│   quizExplainIntent / quizFixIntent / quizTestsIntent... │
└──────────────────────────┬──────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼──────────────────────────────┐
│ Layer 4: 高级系统                                        │
│   BackgroundSummarizer (对话压缩)                         │
│   BackgroundTodoProcessor (后台 todo 管理)                │
│   CacheBreakpoints (Anthropic 缓存优化)                  │
│   AutomodeService (自动模型切换)                          │
└──────────────────────────┬──────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼──────────────────────────────┐
│ Layer 3: 核心执行引擎                                    │
│   ToolCallingLoop (工具调用循环 — 77KB 的 Copilot 核心)    │
│   CodeMapperService (代码编辑映射+应用)                    │
│   EditCodeStep / WorkingSet (编辑工作集管理)               │
│   RequestHandler (请求处理链)                             │
└──────────────────────────┬──────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼──────────────────────────────┐
│ Layer 2: 基础设施                                        │
│   PromptBuilder (prompt 构建系统 — 替代 @vscode/prompt-tsx)│
│   ModelCapabilities (模型能力检测)                        │
│   ToolSchemaNormalizer (工具 schema 规范化)               │
│   Tokenizer/Budget (token 计数+预算管理)                  │
└──────────────────────────┬──────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼──────────────────────────────┐
│ Layer 1: 核心服务 (最底层 — 别人引用它，它不引用别人)       │
│   ★ ToolRegistry/ToolsService (工具注册+发现+执行)        │
│   ★ Endpoint/ModelProvider (模型请求+流式响应)            │
│   Conversation/Turn (对话状态管理)                        │
└──────────────────────────┬──────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼──────────────────────────────┐
│ Layer 0: 类型定义 (已存在)                               │
│   quizIntents.ts — 所有接口/类型                          │
│   VS Code Platform Services — 已有的平台服务              │
└─────────────────────────────────────────────────────────┘
```

## 最底层的关键模块：**ToolRegistry + Endpoint**

这两个是**最底层的、被所有上层依赖的模块**，它们自身不依赖 Quiz 内部的其他模块：

### 1. **ToolRegistry/ToolsService** — 最底层核心

当前状态：**完全缺失**。所有 intent 硬编码工具列表。

为什么它是底层：
- `ToolCallingLoop` 需要它来**执行**工具
- 所有 intent 的 [getAvailableTools()](cci:1://file:///e:/vscode-main/extensions/copilot/src/extension/intents/node/agentIntent.ts:518:1-520:2) 需要它来**发现**工具
- `CodeMapperService` 需要它来获取编辑工具
- `BackgroundSummarizer` 需要它来规范化 tool schema

需要实现：
- 工具注册/发现机制（对齐 VS Code 已有的 `ILanguageModelToolsService`）
- 工具执行框架（调用已注册工具并返回结果）
- 工具 schema 规范化（按模型家族调整参数格式）
- 工具启用/禁用逻辑（基于模型能力、实验开关）

### 2. **Endpoint/ModelProvider** — 最底层核心

当前状态：**stub**（[QuizEndpointImpl.sendChatRequest](cci:1://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser/endpoint/quizEndpointImpl.ts:26:1-34:2) 返回硬编码字符串）。

为什么它是底层：
- `ToolCallingLoop` 需要它来**发送模型请求**
- `PromptBuilder` 需要它来**计算 token 预算**
- `ModelCapabilities` 需要它来**检测模型能力**
- 所有 intent 需要它来**获取 endpoint 信息**

需要实现：
- 真实的模型 API 调用（SSE 流式响应）
- 工具调用响应解析（从模型输出中提取 tool_calls）
- Token 计数/预算管理
- 模型能力检测（supportsToolCalls, supportsApplyPatch 等）

## 建议的实现顺序

| 优先级 | 模块 | 原因 |
|---|---|---|
| **P0** | **Endpoint/ModelProvider** | 没有真实模型调用，一切都无法运行 |
| **P0** | **ToolRegistry/ToolsService** | 没有工具执行，agent 模式无法工作 |
| **P1** | **PromptBuilder** | 替代手动字符串拼接，支持 token 预算 |
| **P1** | **ToolCallingLoop 完善** | 当前是 stub（[_sendModelRequest](cci:1://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common/prompt/quizToolCallingLoop.ts:170:1-194:2) 返回硬编码），需接入真实 Endpoint + Tool 执行 |
| **P2** | **CodeMapperService** | Edit intent 的核心——将模型输出映射为实际文件编辑 |
| **P2** | **EditCodeStep/WorkingSet** | Edit intent 的工作集管理 |
| **P3** | **ModelCapabilities** | 根据模型动态选择工具和编辑策略 |
| **P3** | **BackgroundSummarizer** | Agent intent 的对话压缩 |
| **P4** | **BackgroundTodoProcessor** | Agent intent 的后台 todo |
| **P4** | **AutomodeService** | 自动模型切换 |

**关键路径**：Endpoint → ToolRegistry → ToolCallingLoop → Intent 实现。这条线打通后，基本 agent 流程才能跑起来。


# Quiz vs Copilot 差距分析报告

## 当前状态

`@e:\vscode-main\src\vs\workbench\contrib\quiz` 目录**完全为空**（5 个空目录：[common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/common:0:0-0:0)、[browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/browser:0:0-0:0)、[electron-browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/electron-browser:0:0-0:0)、[node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/log/node:0:0-0:0)、[test/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/test:0:0-0:0)）。

## 架构映射规则

| Copilot 层 | Quiz 目标层 | 说明 |
|---|---|---|
| [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/common:0:0-0:0) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/common:0:0-0:0) | 纯类型、接口、无 DI |
| [vscode-node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/log/vscode-node:0:0-0:0) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/browser:0:0-0:0) | 用 VS Code 内部 DI 服务（IFileService 等），**无 Node API** |
| [node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/log/node:0:0-0:0) | [node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/log/node:0:0-0:0) | 可用 Node API（fs, child_process, http） |
| [vscode/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/git/vscode:0:0-0:0) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/browser:0:0-0:0) | 纯 UI/命令注册 |
| — | [electron-browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/electron-browser:0:0-0:0) | registerSingleton + IPC channel 注册 |

## 需要实现的模块（按优先级排序）

### P0 — 核心骨架（必须先有，其他都依赖）

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 1 | **Contribution 入口** | [extension/vscode-node/extension.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/extension/vscode-node/extension.ts:0:0-0:0) + [contributions.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/common/contributions.ts:0:0-0:0) | `browser/quiz.contribution.ts` | 1 | registerSingleton + registerWorkbenchContribution |
| 2 | **Chat Participant 注册** | [conversation/vscode-node/conversationFeature.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/conversation/vscode-node/conversationFeature.ts:0:0-0:0) | `browser/quizChatParticipant.contribution.ts` | 1 | 注册 Quiz participant 到 IChatAgentService |
| 3 | **Intent 系统** | [intents/common/intents.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/intents/common/intents.ts:0:0-0:0) + [intents/node/allIntents.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/intents/node/allIntents.ts:0:0-0:0) | `common/intents/quizIntents.ts` | 2 | Intent 枚举 + 注册表 |
| 4 | **Request Handler** | [prompt/node/chatParticipantRequestHandler.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/prompt/node/chatParticipantRequestHandler.ts:0:0-0:0) | `browser/quizRequestHandler.ts` | 1 | 请求处理主循环 |
| 5 | **Conversation/Turn** | [prompt/common/conversation.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/prompt/common/conversation.ts:0:0-0:0) | `common/prompt/quizConversation.ts` | 1 | 对话状态管理 |
| 6 | **Tool Calling Loop** | `intents/node/toolCallingLoop.ts` (77K) | `common/intents/quizToolCallingLoop.ts` | 1 | 工具调用循环核心 |

### P1 — Intent 实现

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 7 | **Agent Intent** | `intents/node/agentIntent.ts` (68K) | `browser/intents/quizAgentIntent.ts` | 1 | 默认 Agent 模式 |
| 8 | **Edit Intent** | `intents/node/editCodeIntent.ts` (37K) + `editCodeStep.ts` | `browser/intents/quizEditCodeIntent.ts` | 2 | Edit 模式 + WorkingSet |
| 9 | **Ask Intent** | `intents/node/askAgentIntent.ts` | `browser/intents/quizAskIntent.ts` | 1 | Ask 只读模式 |
| 10 | **Plan Intent** | — | `browser/intents/quizPlanIntent.ts` | 1 | Plan 模式 |
| 11 | **Explore Intent** | — | `browser/intents/quizExploreIntent.ts` | 1 | Explore 模式 |
| 12 | **Inline Chat Intent** | `inlineChat2/node/inlineChatIntent.ts` | `browser/intents/quizInlineChatIntent.ts` | 1 | 内联聊天 |
| 13 | **Review Intent** | `intents/node/reviewIntent.ts` | `browser/intents/quizReviewIntent.ts` | 1 | Code Review |
| 14 | **Fix Intent** | `intents/node/fixIntent.ts` | `browser/intents/quizFixIntent.ts` | 1 | 修复模式 |

### P2 — Prompt 系统

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 15 | **Prompt Renderer** | `prompt/node/chatMLFetcher.ts` (99K) | `common/prompt/quizPromptRenderer.ts` | 1 | Prompt 构建引擎 |
| 16 | **Prompt Elements** | `prompt/node/defaultIntentRequestHandler.ts` (42K) | `common/prompt/quizPromptElements.ts` | 1 | 声明式 Prompt 元素 |
| 17 | **Cache Breakpoints** | `intents/node/cacheBreakpoints.ts` | `common/prompt/quizCacheBreakpoints.ts` | 1 | Anthropic/OpenAI 缓存断点 |
| 18 | **Intent Detector** | `prompt/node/intentDetector.tsx` (27K) | `browser/prompt/quizIntentDetector.ts` | 1 | 意图检测 |
| 19 | **Streaming Edits** | `prompt/node/streamingEdits.ts` (39K) | `browser/prompt/quizStreamingEdits.ts` | 1 | 流式编辑输出 |
| 20 | **Response Processor** | `prompt/node/pseudoStartStopConversationCallback.ts` | `common/prompt/quizResponseProcessor.ts` | 1 | 响应处理回调 |

### P3 — 工具系统

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 21 | **Tools Service** | `tools/common/toolsService.ts` + `toolsRegistry.ts` | `common/tools/quizToolsService.ts` | 2 | 工具注册/调度 |
| 22 | **Edit File Tool** | `tools/node/editFileToolUtils.tsx` (37K) | `browser/tools/quizEditFileTool.ts` | 1 | 编辑文件工具 |
| 23 | **Replace String Tool** | `tools/node/replaceStringTool.tsx` + `abstractReplaceStringTool.tsx` | `common/tools/quizReplaceStringTool.ts` | 2 | 替换字符串 |
| 24 | **Apply Patch Tool** | `tools/node/applyPatchTool.tsx` (42K) | `common/tools/quizApplyPatchTool.ts` | 1 | Apply patch |
| 25 | **Read File Tool** | `tools/node/readFileTool.tsx` (22K) | `browser/tools/quizReadFileTool.ts` | 1 | 读取文件 |
| 26 | **Create File Tool** | `tools/node/createFileTool.tsx` | `browser/tools/quizCreateFileTool.ts` | 1 | 创建文件 |
| 27 | **Find Files Tool** | `tools/node/findFilesTool.tsx` | `browser/tools/quizFindFilesTool.ts` | 1 | 文件搜索 |
| 28 | **Find Text In Files** | `tools/node/findTextInFilesTool.tsx` | `browser/tools/quizFindTextInFilesTool.ts` | 1 | 内容搜索 |
| 29 | **List Dir Tool** | `tools/node/listDirTool.tsx` | `browser/tools/quizListDirTool.ts` | 1 | 目录列表 |
| 30 | **Get Errors Tool** | `tools/node/getErrorsTool.tsx` | `browser/tools/quizGetErrorsTool.ts` | 1 | 获取诊断 |
| 31 | **Codebase Tool** | `tools/node/codebaseTool.tsx` | `browser/tools/quizCodebaseTool.ts` | 1 | 代码库搜索 |
| 32 | **Memory Tool** | `tools/node/memoryTool.tsx` (31K) | `browser/tools/quizMemoryTool.ts` | 1 | 记忆管理 |
| 33 | **Todo List Tool** | `tools/node/manageTodoListTool.tsx` | `browser/tools/quizTodoListTool.ts` | 1 | 任务列表 |
| 34 | **Skill Tool** | `tools/node/skillTool.ts` | `browser/tools/quizSkillTool.ts` | 1 | 技能调用 |
| 35 | **SCM Changes Tool** | `tools/node/scmChangesTool.ts` | `browser/tools/quizScmChangesTool.ts` | 1 | SCM 变更 |
| 36 | **Edit Notebook Tool** | `tools/node/editNotebookTool.tsx` (37K) | `browser/tools/quizEditNotebookTool.ts` | 1 | Notebook 编辑 |
| 37 | **Run Terminal Cmd** | `tools/node/vscodeCmdTool.tsx` | `node/tools/quizRunTerminalCmdTool.ts` | 1 | 终端命令（Node 层） |
| 38 | **Execution Subagent** | `tools/node/executionSubagentTool.tsx` | `browser/tools/quizExecutionSubagentTool.ts` | 1 | 执行子代理 |
| 39 | **Search Subagent** | `tools/node/searchSubagentTool.ts` | `browser/tools/quizSearchSubagentTool.ts` | 1 | 搜索子代理 |
| 40 | **Virtual Tools** | `tools/common/virtualTools/` (12 文件) | `common/virtualTools/` | 6 | 虚拟工具分组 |

### P4 — Endpoint/Model 层

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 41 | **Endpoint Provider** | `platform/endpoint/common/endpointProvider.ts` + `node/chatEndpoint.ts` | `common/endpoint/quizEndpointProvider.ts` | 2 | 端点管理 |
| 42 | **Model Capabilities** | `platform/endpoint/common/chatModelCapabilities.ts` | `common/endpoint/quizModelCapabilities.ts` | 1 | 模型能力路由 |
| 43 | **BYOK Providers** | `byok/vscode-node/` (13 文件) | `browser/byok/` | 5 | 自定义模型提供者 |
| 44 | **Anthropic SDK Provider** | `chatSessions/claude/node/` | `browser/agents/quizAnthropicSdkProvider.ts` | 1 | Anthropic API |
| 45 | **Language Model Server** | `agents/node/langModelServer.ts` | `node/agents/quizLanguageModelServer.ts` | 1 | LM 代理服务器 |

### P5 — Linkify 系统

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 46 | **Linkify Service** | `linkify/common/linkifyService.ts` + `linkifier.ts` | `common/linkify/quizLinkifyService.ts` | 2 | 链接化服务 |
| 47 | **File Path Linkifier** | `linkify/common/filePathLinkifier.ts` | `common/linkify/quizFilePathLinkifier.ts` | 1 | 文件路径链接 |
| 48 | **Symbol Linkifier** | `linkify/vscode-node/symbolLinkifier.ts` + `inlineCodeSymbolLinkifier.ts` | `browser/linkify/quizSymbolLinkifier.ts` | 2 | 符号链接 |
| 49 | **Model File Path Linkifier** | `linkify/common/modelFilePathLinkifier.ts` | `common/linkify/quizModelFilePathLinkifier.ts` | 1 | 模型输出路径链接 |
| 50 | **Response Stream w/ Linkify** | `linkify/common/responseStreamWithLinkification.ts` | `common/linkify/quizResponseStreamWithLinkification.ts` | 1 | 流代理 |

### P6 — 辅助系统

| # | 模块 | Copilot 源 | Quiz 目标 | 文件数 | 说明 |
|---|---|---|---|---|---|
| 51 | **Code Block Processor** | `codeBlocks/node/` | `common/codeBlocks/quizCodeBlockProcessor.ts` | 1 | 代码块解析 |
| 52 | **Edit Survival Tracker** | `platform/editSurvivalTracking/common/` (6 文件) | `common/editing/quizEditSurvivalTracker.ts` | 2 | 编辑存活追踪 |
| 53 | **Edit Tool Learning** | `tools/common/editToolLearningService.ts` | `common/tools/quizEditToolLearningService.ts` | 1 | 编辑学习 |
| 54 | **Diff Service** | `platform/diff/common/` | `common/diff/quizDiffService.ts` | 1 | Diff 计算 |
| 55 | **Embeddings** | `platform/embeddings/common/` (6 文件) | `common/embeddings/` | 4 | 嵌入计算 |
| 56 | **Chat Session Workspace** | `chatSessions/common/` + [vscode-node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/log/vscode-node:0:0-0:0) | [browser/chatSessions/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/chat/browser/chatSessions:0:0-0:0) | 4 | 会话工作区管理 |
| 57 | **MCP Integration** | `mcp/vscode-node/` | `browser/mcp/quizMcpIntegration.ts` | 2 | MCP 集成 |
| 58 | **Review System** | `review/node/` | `browser/review/quizReviewAgent.ts` | 2 | 代码审查 |
| 59 | **Chat Hook Service** | [chat/vscode-node/chatHookService.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/chat/vscode-node/chatHookService.ts:0:0-0:0) | `browser/quizChatHookService.ts` | 1 | Hook 服务 |

## 不需要实现的模块

- **completions/** — 代码补全（独立扩展负责）
- **authentication/** — GitHub OAuth（VS Code 内置）
- **chronicle/** — 云端会话同步（Quiz 无云服务）
- **onboardDebug/** — 调试命令
- **survey/** — 用户调查
- **getting-started/** — 欢迎页
- **settingsSchema/** — 设置 schema
- **workspaceSemanticSearch/** — 语义搜索
- **xtab/** — XTab 功能
- **githubMcp/** — GitHub MCP
- **externalAgents/** — 外部代理
- **inlineEdits/** — 内联编辑（独立功能）
- **trajectory/** — OTel debug（可选后续）

## 建议实施顺序

```
Phase 1: P0 骨架 (6 文件) → 能编译、注册 participant
Phase 2: P1 Intents (8 文件) → 5 种模式可用
Phase 3: P2 Prompt (6 文件) → Prompt 构建完整
Phase 4: P3 Tools (20 文件) → 工具链完整
Phase 5: P4 Endpoint (5 文件) → 多模型支持
Phase 6: P5-P6 辅助 (14 文件) → 生产就绪
```

**总计约 59 个文件**，从零开始构建。建议从 P0 骨架开始，确保 Quiz contribution 能注册到 VS Code workbench 并响应 chat 请求。




























现在让我更仔细地检查 Copilot 的平台层结构，特别是与端点、嵌入、编辑和联网相关的：

现在我已全面了解 Copilot 的目录结构。接下来，我将构建对比分析。

---

## Copilot → Quiz 目录结构对比分析

### Copilot 完整目录树（[src/extension/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension:0:0-0:0)）

```
extension/
├── agents/              node/ + vscode-node/
├── byok/                common/ + node/ + vscode-node/
├── chat/                (8 items)
├── chatInputNotification/ (4 items)
├── chatSessionContext/  (1 item)
├── chatSessions/
│   ├── claude/          common/ + node/ + vscode-node/
│   ├── common/          (17 items)
│   ├── copilotcli/      common/ + node/ + vscode-node/
│   ├── vscode/          (4 items)
│   └── vscode-node/     (54 items)
├── chronicle/           (28 items)
├── codeBlocks/          node/ + vscode-node/
├── commands/            (1 item)
├── common/              (3 items)
├── completions/         (6 items)
├── completions-core/    (350 items)
├── configuration/       (1 item)
├── context/             node/ + vscode/
├── contextKeys/         (1 item)
├── conversation/        common/ + node/ + vscode-node/
├── conversationStore/   (2 items)
├── diagnosticsContext/  (1 item)
├── extension/           (9 items) ← 入口注册
├── externalAgents/      (3 items)
├── git/                 (4 items)
├── githubMcp/           (3 items)
├── inlineChat/          node/ + vscode-node/
├── inlineEdits/         (76 items)
├── intents/             common/ + node/ + vscode-node/
├── linkify/             common/ + vscode-node/
├── log/                 node/ + vscode-node/
├── mcp/                 vscode-node/ + test/
├── notebook/            (1 item)
├── prompt/              common/ + node/ + vscode-node/
├── prompts/             (410 items) ← prompt 模板
├── review/              node/
├── telemetry/           (2 items)
├── test/                (173 items)
├── testing/             (4 items)
├── tools/               common/ + node/ + vscode-node/
│   └── common/virtualTools/ (12 items)
├── trajectory/          vscode-node/
├── typescriptContext/   (112 items)
├── workspaceChunkSearch/ (3 items)
├── workspaceRecorder/   common/ + vscode-node/
├── workspaceSemanticSearch/ (3 items)
└── xtab/                (36 items)
```

### Quiz 当前目录树

```
quiz/
├── browser/
│   ├── quiz.contribution.ts
│   ├── quizChatParticipant.contribution.ts
│   └── quizRequestHandler.ts
├── common/
│   ├── intents/
│   │   └── quizIntents.ts
│   └── prompt/
│       ├── quizConversation.ts
│       └── quizToolCallingLoop.ts
├── electron-browser/    (空)
├── node/                (空)
└── test/                (空)
```

---

## 差距分析：缺失的子目录和文件

### 🔴 严重缺失 — 核心子系统目录

| Copilot 子系统 | Copilot 层 | Quiz 应放层 | Quiz 状态 | 说明 |
|---|---|---|---|---|
| [prompt/common/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/prompt/common:0:0-0:0) (11 文件) | common | `common/prompt/` | ⚠️ **仅 2 文件，缺 9** | 缺 `chatVariablesCollection`, `codeGuesser`, `fileTreeParser`, `importStatement`, [intents](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/intents:0:0-0:0), `promptCategorizationTaxonomy`, `repository`, `specialRequestTypes`, `streamingGrammar`, `toolCallRound` |
| [prompt/node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/prompt/node:0:0-0:0) (49 文件) | node | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** | 核心文件：`chatMLFetcher`(99KB), `chatParticipantRequestHandler`(21KB), `defaultIntentRequestHandler`(42KB), `intentDetector`(27KB), `toolCallingLoop`(77KB→已在intents), `streamingEdits`(39KB) |
| [prompt/vscode-node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/prompt/vscode-node:0:0-0:0) (14 文件) | vscode-node | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** | `endpointProviderImpl`, `requestLoggerImpl`, `gitDiffService`, `promptVariablesService` |
| [intents/node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/intents/node:0:0-0:0) (41 文件) | node | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ⚠️ **仅 1 文件** | 缺 `agentIntent`(68KB), `editCodeIntent`(37KB), `editCodeStep`(16KB), `newIntent`(27KB), `toolCallingLoop`(77KB), `reviewIntent` 等 |
| [intents/common/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/intents/common:0:0-0:0) (2 文件) | common | `common/intents/` | ⚠️ **缺 [agentConfig.ts](cci:7://file:///e:/vscode-main/extensions/copilot/src/extension/intents/common/agentConfig.ts:0:0-0:0)** | |
| [tools/common/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/tools/common:0:0-0:0) (26 文件) | common | `common/tools/` | ❌ **完全缺失** | `toolsService`, `toolsRegistry`, `toolNames`, `editToolLearningService`, [virtualTools/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/tools/common/virtualTools:0:0-0:0)(12 文件) |
| [tools/node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/tools/node:0:0-0:0) (83 文件) | node | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** | 所有工具实现：`readFileTool`, `editFileTool`, `applyPatchTool`, `memoryTool`, `codebaseTool` 等 |
| [tools/vscode-node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/tools/vscode-node:0:0-0:0) (7 文件) | vscode-node | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** | `toolsService` 实现, `fetchWebPageTool`, `switchAgentTool` |

### 🔴 严重缺失 — 平台层子系统

| Copilot 平台子系统 | Quiz 应放层 | Quiz 状态 |
|---|---|---|
| [platform/endpoint/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/endpoint:0:0-0:0) (49 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [platform/networking/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/networking:0:0-0:0) (29 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [platform/embeddings/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/embeddings:0:0-0:0) (8 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) | ❌ **完全缺失** |
| [platform/editing/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/editing:0:0-0:0) (8 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [platform/diff/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/diff:0:0-0:0) (4 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [platform/telemetry/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/telemetry:0:0-0:0) (20 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** |
| [platform/git/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/git:0:0-0:0) (12 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** |

### 🟡 中等缺失 — 辅助子系统

| Copilot 子系统 | Quiz 应放层 | Quiz 状态 |
|---|---|---|
| [chatSessions/claude/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/chatSessions/claude:0:0-0:0) (93 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [conversation/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/conversation:0:0-0:0) (26 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** |
| [linkify/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/linkify:0:0-0:0) (24 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** |
| [review/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/review:0:0-0:0) (6 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [byok/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/byok:0:0-0:0) (34 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [inlineChat/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/inlineChat:0:0-0:0) (7 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [codeBlocks/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/codeBlocks:0:0-0:0) (4 文件) | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [context/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/context:0:0-0:0) (11 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [log/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/log:0:0-0:0) (6 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |
| [mcp/](cci:9://file:///e:/vscode-main/extensions/copilot/src/platform/mcp:0:0-0:0) (21 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ❌ **完全缺失** |
| [agents/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/agents:0:0-0:0) (21 文件) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) + [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | ❌ **完全缺失** |

---

## 层映射正确性检查

### Copilot 层 → Quiz 层 映射规则

| Copilot 层 | 含义 | Quiz 对应层 | 原因 |
|---|---|---|---|
| [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) | 纯类型/接口/逻辑 | [common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) | 1:1 |
| [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | 可用 Node API + 无 vscode API | [node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) | 1:1（worker、fs、child_process） |
| [vscode-node/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/mcp/vscode-node:0:0-0:0) | 可用 `import * as vscode` + Node API | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | Quiz 用内部 API 代替 [vscode](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/context/vscode:0:0-0:0) 扩展 API |
| [vscode/](cci:9://file:///e:/vscode-main/extensions/copilot/src/extension/context/vscode:0:0-0:0) | 仅 `import * as vscode` | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | 同上 |

### ⚠️ 现有文件的层正确性问题

| 文件 | 当前层 | 问题 | 建议 |
|---|---|---|---|
| [quizToolCallingLoop.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common/prompt/quizToolCallingLoop.ts:0:0-0:0) | `common/prompt/` | ✅ 正确 — 纯逻辑类，无 DI、无平台 API | 保留 |
| [quizConversation.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common/prompt/quizConversation.ts:0:0-0:0) | `common/prompt/` | ✅ 正确 — 纯数据类 | 保留 |
| [quizIntents.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common/intents/quizIntents.ts:0:0-0:0) | `common/intents/` | ⚠️ **`createDecorator` 在 common 合规但需注意** | 合规（VS Code 惯例），但未来实现类必须放 [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) |
| [quizRequestHandler.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser/quizRequestHandler.ts:0:0-0:0) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ✅ 正确 — 有 DI 装饰器 | 保留 |
| [quiz.contribution.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser/quiz.contribution.ts:0:0-0:0) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ✅ 正确 — `registerWorkbenchContribution2` | 保留 |
| [quizChatParticipant.contribution.ts](cci:7://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser/quizChatParticipant.contribution.ts:0:0-0:0) | [browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) | ✅ 正确 — 注册 agent + localize | 保留 |

---

## 建议的 Quiz 完整目录规划

```
quiz/
├── common/                          ← 纯类型/接口/逻辑，无 DI
│   ├── intents/
│   │   ├── quizIntents.ts           ✅ 已有
│   │   └── quizAgentConfig.ts       ❌ 缺失（对齐 intents/common/agentConfig.ts）
│   ├── prompt/
│   │   ├── quizConversation.ts      ✅ 已有
│   │   ├── quizToolCallingLoop.ts   ✅ 已有
│   │   ├── quizChatVariables.ts     ❌ 缺失（对齐 chatVariablesCollection.ts）
│   │   ├── quizCodeGuesser.ts       ❌ 缺失
│   │   ├── quizFileTreeParser.ts    ❌ 缺失
│   │   ├── quizStreamingGrammar.ts   ❌ 缺失
│   │   └── quizToolCallRound.ts     ❌ 缺失
│   ├── tools/                       ❌ 整个目录缺失
│   │   ├── quizToolNames.ts
│   │   ├── quizToolsService.ts      ← 接口+createDecorator
│   │   ├── quizToolsRegistry.ts
│   │   ├── quizEditToolLearning.ts
│   │   ├── quizToolSchemaNormalizer.ts
│   │   └── virtualTools/           ❌ 缺失
│   ├── endpoint/                    ❌ 整个目录缺失
│   │   ├── quizEndpointTypes.ts
│   │   ├── quizEndpointProvider.ts  ← 接口+createDecorator
│   │   ├── quizModelCapabilities.ts
│   │   └── quizChatModelCapabilities.ts
│   ├── editing/                     ❌ 整个目录缺失
│   │   ├── quizEditFileResult.ts
│   │   ├── quizAbstractReplaceStringTool.ts
│   │   └── quizEditFileToolUtils.ts
│   ├── embeddings/                  ❌ 整个目录缺失
│   ├── linkify/                     ❌ 整个目录缺失
│   ├── conversation/                ❌ 整个目录缺失
│   ├── byok/                        ❌ 整个目录缺失
│   │   ├── quizByokTypes.ts
│   │   ├── quizCustomOAIProvider.ts
│   │   └── quizAzureProvider.ts
│   ├── review/                      ❌ 整个目录缺失
│   ├── codeBlocks/                  ❌ 整个目录缺失
│   └── context/                     ❌ 整个目录缺失
│
├── browser/                         ← DI 服务 + UI + 命令
│   ├── quiz.contribution.ts         ✅ 已有
│   ├── quizChatParticipant.contribution.ts ✅ 已有
│   ├── quizRequestHandler.ts        ✅ 已有
│   ├── prompt/                      ❌ 缺失（对齐 prompt/vscode-node/）
│   │   ├── quizEndpointProviderImpl.ts
│   │   ├── quizRequestLoggerImpl.ts
│   │   ├── quizPromptVariablesService.ts
│   │   └── quizGitDiffService.ts
│   ├── intents/                     ❌ 缺失（对齐 intents/node/ + vscode-node/）
│   │   ├── quizAgentIntent.ts
│   │   ├── quizEditCodeIntent.ts
│   │   ├── quizEditCodeStep.ts
│   │   ├── quizIntentDetector.ts
│   │   ├── quizIntentServiceImpl.ts
│   │   └── quizToolCallingLoopImpl.ts
│   ├── tools/                       ❌ 缺失（对齐 tools/node/ + vscode-node/）
│   │   ├── quizAllTools.ts
│   │   ├── quizReadFileTool.ts
│   │   ├── quizEditFileTool.ts
│   │   ├── quizApplyPatchTool.ts
│   │   ├── quizMemoryTool.ts
│   │   ├── quizCodebaseTool.ts
│   │   └── ...
│   ├── agents/                      ❌ 缺失（对齐 chatSessions/claude/）
│   │   └── claude/
│   │       ├── quizClaudeAgent.ts
│   │       ├── quizClaudeSdkService.ts
│   │       └── ...
│   ├── endpoint/                    ❌ 缺失
│   │   └── quizEndpointProviderImpl.ts
│   ├── linkify/                     ❌ 缺失
│   ├── review/                      ❌ 缺失
│   ├── mcp/                         ❌ 缺失
│   ├── inlineChat/                  ❌ 缺失
│   └── context/                     ❌ 缺失
│
├── electron-browser/                ← Electron 特有覆盖
│   └── (暂空，Electron 特有 registerSingleton 覆盖)
│
├── node/                            ← Node API（fs, child_process, worker）
│   ├── agents/                      ❌ 缺失（对齐 chatSessions/claude/node/）
│   │   └── claude/
│   │       ├── quizClaudeSdkWorkerMain.ts
│   │       └── quizClaudeLanguageModelServer.ts
│   ├── prompt/                      ❌ 缺失（对齐 prompt/node/ 中需 Node API 的文件）
│   └── endpoint/                    ❌ 缺失（对齐 platform/endpoint/node/）
│
└── test/                            ← 测试
    ├── common/
    ├── browser/
    └── node/
```

---

## 关键发现总结

1. **现有 6 个文件分层全部正确**，0 个层违规
2. **[common/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/common:0:0-0:0) 仅覆盖了 3/15 的子系统**（intents、prompt/conversation、prompt/toolCallingLoop），缺 12 个子系统目录
3. **[browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/browser:0:0-0:0) 仅覆盖了 3 个顶层文件**，缺所有子目录（prompt/、intents/、tools/、agents/、endpoint/、linkify/、review/、mcp/、inlineChat/、context/）
4. **[node/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/node:0:0-0:0) 完全为空** — 但 Copilot 有大量 Node 层文件（worker main、SDK service、fs 操作）
5. **[electron-browser/](cci:9://file:///e:/vscode-main/src/vs/workbench/contrib/quiz/electron-browser:0:0-0:0) 为空** — 正确，暂无 Electron 特有需求
6. **[test/](cci:9://file:///e:/vscode-main/extensions/copilot/test:0:0-0:0) 为空** — Copilot 有 952 个测试文件

最紧迫的缺失是 **`common/tools/`**、**`common/endpoint/`**、**`common/editing/`** 和 **`browser/intents/`**（实现类）—— 这些是 tool calling loop 和 request handler 运行所必需的。
