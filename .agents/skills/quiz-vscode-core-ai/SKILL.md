---
name: quiz-vscode-core-ai
description: "Integrate AI chat capabilities branded as 'Quiz' into VS Code Core as a workbench contribution. Use when (1) Implementing quiz agent, prompts, tools, or UI in VS Code Core source tree, (2) Working with src/vs/workbench/contrib/quiz/ directory structure, (3) Migrating Copilot Chat extension logic into Core contribution format, (4) Integrating quiz with the chat infrastructure (contrib/chat/), (5) Implementing prompt builders, tool systems, or session registration for quiz, (6) Building quiz chat UI widgets, panels, or inline editing, (7) Registering quiz as a Core contribution (not extension), (8) Any task involving quiz within the VS Code Core workbench."
---

# Quiz VS Code Core AI Integration

Implement Quiz AI assistant as a VS Code **Core Contribution** at `src/vs/workbench/contrib/quiz/` — not as an extension.

## Core Principle

Quiz is a **workbench contribution**, not an extension. All code lives in:

```
src/vs/workbench/contrib/quiz/
```

It directly imports from `contrib/chat/` infrastructure and other core modules using internal APIs — never `vscode.*` extension API.

## ⚠️ Critical Corrections from Code Audit

### 1. NO `@vscode/prompt-tsx` in Core

`@vscode/prompt-tsx` is an npm package used ONLY by the Copilot Chat extension (86 files import it). VS Code Core does NOT have `contrib/chat/common/prompts/promptTsx`. Core only has `common/tools/promptTsxTypes.ts` (a small JSON serializer for tool results).

**Quiz must use pure TypeScript prompt builders**, not TSX components.

### 2. Use `IChatSessionsService`, NOT `IChatAgentService.registerAgent()`

Core built-in session providers (AgentHost, Claude, Codex) register via `IChatSessionsService`:
- `registerChatSessionContribution()` — session type in picker
- `registerChatSessionItemController()` — session list in sidebar
- `registerChatSessionContentProvider()` — chat content handler

`registerAgent()` / `registerAgentImplementation()` is for extensions. Core uses the session provider pattern.

### 3. Entry Points are `workbench.common.main.ts` and `workbench.desktop.main.ts`

`workbench.common.main.ts` IS the primary entry point for shared (web + desktop) contributions. Chat contributions are registered there:
- `workbench.common.main.ts` — shared browser contributions (imported by both web and desktop)
- `workbench.desktop.main.ts` — desktop-only contributions (electron-browser layer)

Quiz browser contributions go in `workbench.common.main.ts`, electron contributions in `workbench.desktop.main.ts`.

### 4. Tools Must Be Layered (common vs electron-browser)

Tools needing Node.js APIs (readFile, editFile, terminal, findFiles, findTextInFiles) MUST go in `electron-browser/tools/`. Only browser-safe tools go in `browser/tools/`.

### 5. Must Add `SessionType.Quiz` and `AgentSessionProviders.Quiz`

All built-in session providers have entries in:
- `chat/common/chatSessionsService.ts` → `SessionType` namespace
- `chat/browser/agentSessions/agentSessions.ts` → `AgentSessionProviders` enum + metadata functions

### 6. Must Register Language Model Vendor

Call `ILanguageModelsService.deltaLanguageModelChatProviderDescriptors()` + `registerLanguageModelProvider()` to make Quiz models appear in the model picker. See `agentHostLanguageModelProvider.ts` for the pattern.

## 🔍 Deep Audit: What Copilot Has That Skills Still Miss

After systematically reviewing all 60+ directories in `vscode-copilot-chat-main/src/extension/` and `src/platform/`, these are the **missing subsystems** not covered by any skill:

### Missing Subsystem A: Chat Hooks System

**Copilot:** `extension/chat/vscode-node/chatHookService.ts` (21KB) + `platform/chat/common/chatHookService.ts` (9KB) + `platform/chat/common/hookExecutor.ts` + `platform/chat/common/hookCommandTypes.ts`

Hooks run at specific points during chat processing (from `vscode.proposed.chatHooks.d.ts`):
- `SessionStart` hook — runs when a chat session begins
- `SessionEnd` hook — runs when a chat session ends
- `UserPromptSubmit` hook — runs when user submits a prompt
- `PreToolUse` hook — runs before each tool invocation (can block/modify)
- `PostToolUse` hook — runs after each tool invocation (can modify result)
- `PreCompact` hook — runs before context compaction
- `SubagentStart` / `SubagentStop` hooks — for subagent lifecycle
- `Stop` hook — runs when the agent tries to stop (can force continuation)
- `ErrorOccurred` hook — runs when an error occurs

**Quiz needs:** `common/hooks/quizHookService.ts` (interface) + `browser/hooks/quizHookServiceImpl.ts`

### Missing Subsystem B: Session Transcript Service

**Copilot:** `extension/chat/vscode-node/sessionTranscriptService.ts` (11KB) + `platform/chat/common/sessionTranscriptService.ts` (8KB)

Maintains a structured transcript of the entire conversation including:
- Tool call rounds with timestamps
- Token usage per round
- Compaction metadata
- Hook context from each round
- Phase tracking (which agent phase produced each round)

**Quiz needs:** `common/session/quizSessionTranscript.ts` (interface + implementation)

### Missing Subsystem C: Tool Calling Loop

**Copilot:** `extension/intents/node/toolCallingLoop.ts` (87KB!) — the single largest file in the extension.

This is the **core agent loop** that:
1. Sends a request to the LLM
2. If the LLM returns tool calls, executes them
3. Feeds tool results back to the LLM
4. Repeats until the LLM stops calling tools or hits a limit
5. Handles tool call limits (confirm vs. stop)
6. Processes hooks before/after each tool call
7. Tracks token usage across rounds
8. Handles cancellation and errors
9. Supports subagent delegation
10. Manages thinking/reasoning data

**Quiz needs:** `common/agentLoop/quizToolCallingLoop.ts` — this is the most critical missing piece. Without it, the agent cannot execute tools in a loop.

### Missing Subsystem D: Chat History Builder

**Copilot:** `extension/chatSessions/vscode-node/chatHistoryBuilder.ts` (19KB)

Builds the chat history model from session transcript data:
- Converts tool call rounds into chat messages
- Handles compaction/summarization of old rounds
- Manages context window budget
- Builds the message array sent to the LLM

**Quiz needs:** `common/session/quizChatHistoryBuilder.ts`

### Missing Subsystem E: Checkpoint / Worktree Service

**Copilot:** `extension/chatSessions/common/chatSessionWorktreeService.ts` (4KB interface) + `extension/chatSessions/vscode-node/chatSessionWorktreeServiceImpl.ts` (38KB) + `chatSessionWorktreeCheckpointServiceImpl.ts` (11KB)

When the agent edits files, checkpoints save the state so users can undo:
- Creates a git worktree for each session
- Saves checkpoints before each edit
- Supports undo/redo of agent edits
- Manages worktree lifecycle

**Quiz needs:** `common/checkpoint/quizCheckpointService.ts` (interface) + `electron-browser/checkpoint/quizCheckpointServiceImpl.ts`

### Missing Subsystem F: Session Metadata Store

**Copilot:** `extension/chatSessions/common/chatSessionMetadataStore.ts` (4KB) + `extension/chatSessions/vscode-node/chatSessionMetadataStoreImpl.ts` (19KB)

Persists session metadata across restarts:
- Session title, model, mode
- Token usage summary
- Customization state
- Session creation/update timestamps

**Quiz needs:** `common/session/quizSessionMetadataStore.ts`

### Missing Subsystem G: Feedback Collection & Reporting

**Copilot:** `extension/conversation/vscode-node/feedbackCollection.ts` (4KB) + `feedbackReporter.ts` (12KB) + `feedbackContribution.ts` (1.9KB)

Users can report issues with AI responses:
- Thumbs up/down feedback
- Issue reporting with details
- Feedback telemetry

**Quiz needs:** `browser/feedback/quizFeedbackService.ts`

### Missing Subsystem H: Welcome Message Provider

**Copilot:** `extension/conversation/vscode-node/welcomeMessageProvider.ts` (1.9KB) + `extension/getting-started/`

Custom welcome message when the chat panel first opens:
- Getting started instructions
- Feature highlights
- Walkthrough links

**Quiz needs:** `browser/welcome/quizWelcomeMessageProvider.ts`

### Missing Subsystem I: Chat Debug / Request Logger

**Copilot:** `extension/chat/vscode-node/chatDebugFileLoggerService.ts` (52KB!) + `platform/chat/common/chatDebugFileLoggerService.ts` (7KB) + `extension/log/vscode-node/requestLoggerImpl.ts` (29KB)

Debug logging for chat requests:
- Full request/response logging to files
- OTel span tracking
- Performance marks
- Request correlation IDs

**Quiz needs:** `common/debug/quizDebugLogger.ts` (simplified version)

### Missing Subsystem J: Customization Sync Provider

**Copilot:** `agentHostChatContribution.ts` lines 192-229 — `AgentCustomizationSyncProvider` + `AgentCustomizationItemProvider` + `SyncedCustomizationBundler`

Syncs AI customizations (instructions, prompts, skills) between the session and the customization system:
- `ICustomizationHarnessService.registerExternalHarness()` — required for customization UI
- Sync provider for pushing/pulling customizations
- Item provider for listing available customizations
- Bundler for combining multiple customization sources

**Quiz needs:** `browser/customization/quizCustomizationSyncProvider.ts` + `quizCustomizationItemProvider.ts`

### Missing Subsystem K: External Path Confirmation

**Copilot:** `chat/electron-browser/builtInTools/tools.ts` lines 48-102 — `ChatExternalPathConfirmationContribution`

When tools access files outside the workspace, the user must approve:
- Tracks approved external paths
- Shows confirmation dialog for new paths
- Persists approvals in storage
- Shared between read_file and list_dir tools

**Quiz needs:** `electron-browser/confirmation/quizExternalPathConfirmation.ts`

### Missing Subsystem L: Language Model Access / Quota

**Copilot:** `extension/conversation/vscode-node/languageModelAccess.ts` (37KB) + `platform/chat/common/chatQuotaService.ts` + `chatQuotaServiceImpl.ts`

Manages model access and quotas:
- Model capability detection (tool calling, vision, etc.)
- Reasoning effort configuration
- Rate limit handling
- Quota tracking
- Auto-downgrade on rate limit

**Quiz needs:** `common/modelAccess/quizModelAccessService.ts` (simplified)

### Missing Subsystem M: Code Block Actions

**Copilot:** `extension/codeBlocks/vscode-node/` (2 files)

Actions on code blocks in chat responses:
- Copy code
- Insert at cursor
- Run in terminal
- Create new file

**Quiz needs:** This is likely handled by Core's existing code block infrastructure.

### Missing Subsystem N: Terminal Fix Generator

**Copilot:** `extension/conversation/vscode-node/terminalFixGenerator.ts` (10KB)

When terminal commands fail, suggests fixes:
- Analyzes terminal error output
- Suggests corrected commands
- Handles common error patterns

**Quiz needs:** `browser/terminal/quizTerminalFixGenerator.ts`

### Missing Subsystem O: Title Provider

**Copilot:** `extension/prompt/node/title.ts` (3.3KB) — `ChatTitleProvider`

Auto-generates titles for chat sessions based on the first message.

**Quiz needs:** `browser/prompt/quizTitleProvider.ts`

## Complete Directory Structure (Updated)

```
contrib/quiz/
├── browser/                              # Core-ai browser implementations
│   ├── quiz.contribution.ts              # Main registration entry
│   ├── endpoint/                         # AI backend (browser)
│   │   ├── quizEndpointImpl.ts           # fetch()-based streaming
│   │   ├── quizStreamingEndpoint.ts      # SSE handler
│   │   ├── quizRetryPolicy.ts            # Exponential backoff
│   │   └── quizResponseConverter.ts      # API response → QuizChunk
│   ├── auth/
│   │   └── quizAuthProviderImpl.ts       # Via IAuthenticationService
│   ├── parser/
│   │   ├── quizResponseParserImpl.ts     # Markdown + tool call parsing
│   │   └── quizProgressAdapter.ts        # QuizChunk → IChatProgress
│   ├── context/
│   │   ├── workspaceContext.ts
│   │   ├── editorContext.ts
│   │   ├── gitContext.ts
│   │   ├── diagnosticsContext.ts
│   │   └── quizContextProvider.ts
│   └── telemetry/
│       └── quizTelemetryServiceImpl.ts
│
│   # ⬇️ Other skills own these browser/ subdirectories (not duplicated here):
│   # quiz-chat-ui:        quizAgentView.ts, quizWidget.ts, quizInputPart.ts, etc.
│   # quiz-prompt-engineering: browser/prompt/ (5 files)
│   # quiz-agent-tools:    browser/tools/ (11 files)
│   # quiz-agent-runtime:  browser/agentLoop/, browser/hooks/, browser/agents/
│   # quiz-session-management: browser/session/, browser/customization/, browser/byok/, etc.
│
├── common/                               # Core-ai common (platform-agnostic)
│   ├── quizTypes.ts                      # Core type definitions
│   ├── quizConfiguration.ts             # Configuration keys
│   ├── quizToolIds.ts                    # Tool ID enum (shared with quiz-agent-tools)
│   ├── quizLanguageModels.ts             # Language model descriptors
│   ├── quizService.ts                    # IQuizService interface
│   ├── quizServiceImpl.ts                # Core orchestration
│   ├── quizAgent.ts                      # Session registration
│   ├── quizSessionItemController.ts      # IChatSessionItemController
│   ├── quizSessionHandler.ts             # IChatSessionContentProvider
│   ├── quizLanguageModelProvider.ts      # ILanguageModelChatProvider
│   ├── quizSlashCommands.ts              # Slash command definitions
│   ├── constants.ts                      # SessionType.Quiz, vendor, etc.
│   ├── model/quizSession.ts              # Session data model
│   ├── endpoint/
│   │   ├── quizEndpoint.ts               # IQuizEndpoint interface
│   │   ├── quizEndpointTypes.ts          # Request/Response types
│   │   └── quizModelRouter.ts            # Model → endpoint routing
│   ├── auth/quizAuthProvider.ts          # IQuizAuthProvider interface
│   ├── parser/
│   │   ├── quizResponseParser.ts         # IQuizResponseParser interface
│   │   └── quizCodeParser.ts             # Code block parser interface
│   ├── context/
│   │   ├── workspaceContext.ts           # IQuizWorkspaceContext interface
│   │   ├── editorContext.ts              # IQuizEditorContext interface
│   │   ├── gitContext.ts                 # IQuizGitContext interface
│   │   ├── diagnosticsContext.ts         # IQuizDiagnosticsContext interface
│   │   └── quizContextProvider.ts        # IQuizContextProvider interface
│   ├── intents/
│   │   ├── intentTypes.ts               # QuizIntent enum
│   │   ├── intentService.ts             # IQuizIntentService interface
│   │   └── intentHandlers.ts            # Intent handler registry
│   └── telemetry/
│       └── quizTelemetry.ts              # IQuizTelemetryService interface
│
│   # ⬇️ Other skills own these common/ subdirectories (not duplicated here):
│   # quiz-prompt-engineering: common/prompt/ (4 files)
│   # quiz-agent-runtime:      common/agentLoop/ (4 files), common/hooks/ (3 files), common/agents/ (3 files)
│   # quiz-session-management: common/session/, common/checkpoint/, common/feedback/, common/byok/, etc.
│
├── electron-browser/                     # Core-ai electron implementations
│   ├── quiz.electron.contribution.ts     # Electron contribution entry
│   ├── quizLifecycleHandler.ts           # Shutdown/suspend lifecycle
│   ├── endpoint/
│   │   ├── quizNativeEndpoint.ts         # Node.js HTTP streaming
│   │   └── quizNativeResponseConverter.ts
│   ├── auth/quizNativeAuthProvider.ts    # Native auth (keytar/secretstorage)
│   └── parser/quizNativeCodeParser.ts    # Native AST parsing
│
│   # ⬇️ Other skills own these electron-browser/ subdirectories (not duplicated here):
│   # quiz-agent-tools:        electron-browser/tools/ (20 files)
│   # quiz-prompt-engineering: electron-browser/prompt/ (2 files)
│   # quiz-agent-runtime:      electron-browser/agentLoop/, hooks/, agents/
│   # quiz-session-management: electron-browser/session/, checkpoint/, confirmation/, byok/, embeddings/, etc.
│
└── test/
    ├── common/
    │   └── quizService.test.ts
    └── browser/
        └── quizEndpoint.test.ts
```

## Registration Pattern (Following AgentHostContribution Exactly)

对标 Core `agentHostChatContribution.ts` (318 行) 的 `_registerAgent()` 方法。以下代码逐行对齐实际 Core 注册流程：

```typescript
// browser/quiz.contribution.ts
// 精确对标 agentHostChatContribution.ts#_registerAgent()

export class QuizContribution extends Disposable implements IWorkbenchContribution {
  static readonly ID = 'workbench.contrib.quizContribution';

  constructor(
    @IChatSessionsService private readonly _chatSessionsService: IChatSessionsService,
    @IConfigurationService private readonly _configurationService: IConfigurationService,
    @ICustomizationHarnessService private readonly _customizationHarnessService: ICustomizationHarnessService,
    @ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
    @IInstantiationService private readonly _instantiationService: IInstantiationService,
    @IStorageService private readonly _storageService: IStorageService,
    @IFileService private readonly _fileService: IFileService,
    @ILogService private readonly _logService: ILogService,
    @IPromptsService private readonly _promptsService: IPromptsService,
    @IAuthenticationService private readonly _authenticationService: IAuthenticationService,
  ) {
    super();

    // Gated on quiz.enabled setting (对标 AgentHostEnabledSettingId)
    if (!this._configurationService.getValue<boolean>('quiz.enabled')) {
      return;
    }

    this._registerQuiz();
  }

  private _registerQuiz(): void {
    const store = new DisposableStore();
    this._register(store); // 所有注册随 contribution dispose 一起清理

    const sessionType = 'quiz';  // 同时用作 URI scheme 和 sessionType
    const agentId = sessionType;
    const vendor = sessionType;

    // ── 1. Chat session contribution ──
    // 对标 agentHostChatContribution.ts:172-184
    // 参数类型: IChatSessionsExtensionPoint (chatSessionsService.ts:84-119)
    store.add(this._chatSessionsService.registerChatSessionContribution({
      type: sessionType,
      name: agentId,
      displayName: 'Quiz',
      description: 'Interactive quiz and learning agent',
      canDelegate: true,
      requiresCustomModels: true,
      supportsDelegation: true,
      capabilities: {
        supportsCheckpoints: true,
        supportsPromptAttachments: true,
      },
    }));

    // ── 2. Session list controller ──
    // 对标 agentHostChatContribution.ts:186-190
    const listController = store.add(
      this._instantiationService.createInstance(QuizSessionListController, sessionType)
    );
    store.add(this._chatSessionsService.registerChatSessionItemController(sessionType, listController));

    // ── 3. Customization harness ──
    // 对标 agentHostChatContribution.ts:192-229
    const syncProvider = store.add(new QuizCustomizationSyncProvider(sessionType, this._storageService));
    const itemProvider = store.add(
      new QuizCustomizationItemProvider(this._fileService, this._logService)
    );
    const bundler = store.add(
      this._instantiationService.createInstance(QuizCustomizationBundler, sessionType)
    );
    store.add(this._customizationHarnessService.registerExternalHarness({
      id: sessionType,
      label: 'Quiz',
      icon: ThemeIcon.fromId(Codicon.book.id),
      hiddenSections: [],
      hideGenerateButton: false,
      getStorageSourceFilter: () => ({ sources: AICustomizationSources.all }),
      syncProvider,
      itemProvider,
    }));

    // Customization observable — 对标 agentHostChatContribution.ts:214-229
    const customizations = observableValue<CustomizationRef[]>('quizCustomizations', []);
    const updateCustomizations = async () => {
      const refs = await resolveCustomizationRefs(
        this._promptsService, syncProvider, bundler, sessionType
      );
      if (equals(customizations.get(), refs)) { return; }
      customizations.set(refs, undefined);
    };
    store.add(syncProvider.onDidChange(() => updateCustomizations()));
    store.add(Event.any(
      this._promptsService.onDidChangeCustomAgents,
      this._promptsService.onDidChangeSlashCommands,
      this._promptsService.onDidChangeSkills,
      this._promptsService.onDidChangeInstructions,
    )(() => updateCustomizations()));
    updateCustomizations(); // resolve initial state

    // ── 4. Session content provider ──
    // 对标 agentHostChatContribution.ts:231-244
    // 注意: registerChatSessionContentProvider(scheme, provider)
    //   scheme 参数 = sessionType (Core 内部把 sessionType 当作 URI scheme)
    const sessionHandler = store.add(
      this._instantiationService.createInstance(QuizSessionHandler, {
        sessionType,
        agentId,
        fullName: 'Quiz',
        listController,
        customizations,
      })
    );
    store.add(this._chatSessionsService.registerChatSessionContentProvider(sessionType, sessionHandler));

    // ── 5. Language model vendor + provider ──
    // 对标 agentHostChatContribution.ts:246-256
    // 顺序重要: registerLanguageModelProvider 必须在 updateModels 之前
    const vendorDescriptor = {
      vendor,
      displayName: 'Quiz',
      configuration: undefined,
      managementCommand: undefined,
      when: undefined,
    };
    this._languageModelsService.deltaLanguageModelChatProviderDescriptors([vendorDescriptor], []);
    store.add(toDisposable(() =>
      this._languageModelsService.deltaLanguageModelChatProviderDescriptors([], [vendorDescriptor])
    ));
    const modelProvider = store.add(new QuizLanguageModelProvider(sessionType, vendor));
    store.add(this._languageModelsService.registerLanguageModelProvider(vendor, modelProvider));
    // modelProvider.updateModels(...) — 在模型列表可用时调用

    // ── 6. Tools ──
    store.add(this._instantiationService.createInstance(QuizToolsContribution));
  }
}
```

### IChatSession 接口精确签名 (chatSessionsService.ts:237-283)

Quiz 的 SessionHandler 必须返回实现此接口的对象：

```typescript
// 来自 Core chatSessionsService.ts:237-283
export interface IChatSession extends IDisposable {
  readonly onWillDispose: Event<void>;
  readonly sessionResource: URI;
  readonly title?: string;
  readonly history: readonly IChatSessionHistoryItem[];
  readonly options?: ReadonlyChatSessionOptionsMap;

  // ── Observable 进度 (Core UI 绑定) ──
  readonly progressObs?: IObservable<IChatProgress[]>;
  readonly isCompleteObs?: IObservable<boolean>;
  readonly interruptActiveResponseCallback?: () => Promise<boolean>;

  // ── 服务端主动发起请求 ──
  readonly onDidStartServerRequest?: Event<{ prompt: string; variableData?: IChatRequestVariableData }>;

  // ── 编辑会话转移 ──
  transferredState?: {
    readonly editingSession: IChatEditingSession | undefined;
    readonly inputState: ISerializableChatModelInputState | undefined;
  };

  // ── 请求处理入口 ──
  // 对标 AgentHostSessionHandler: requestHandler 是 Core 调用的入口
  requestHandler?: (
    request: IChatAgentRequest,
    progress: (progress: IChatProgress[]) => void,
    history: any[],  // TODO: Core 源码中也是 any
    token: CancellationToken
  ) => Promise<void>;

  // ── 会话分叉 ──
  forkSession?: (request: IChatSessionRequestHistoryItem | undefined, token: CancellationToken) => Promise<IChatSessionItem>;
}
```

### IChatSessionContentProvider 接口 (chatSessionsService.ts:285-302)

```typescript
export interface IChatSessionContentProvider {
  provideChatSessionContent(sessionResource: URI, token: CancellationToken): Promise<IChatSession>;
  provideChatInputCompletions?(sessionResource: URI, params: IChatInputCompletionsParams, token: CancellationToken): Promise<IChatInputCompletionsResult | undefined>;
  provideChatInputCompletionTriggerCharacters?(): Promise<readonly string[]>;
}
```

## Service Implementation (Core Orchestration)

```typescript
// common/quizServiceImpl.ts
export class QuizServiceImpl implements IQuizService {
  // Full request lifecycle:
  // 1. handleRequest() — entry point from session handler
  // 2. hookService.executeSessionStartHooks() — session start hooks
  // 3. intentService.classify() — detect intent
  // 4. contextProvider.gather() — collect workspace/editor/git/diagnostics context
  // 5. promptBuilder.build() — assemble system prompt + context + history
  // 6. chatHistoryBuilder.build() — convert transcript to LLM message array
  // 7. toolCallingLoop.execute() — THE CORE LOOP:
  //    a. Send messages to LLM via endpoint
  //    b. Parse streaming response
  //    c. If tool calls: execute hooks → execute tools → add results → loop
  //    d. If no tool calls: done
  // 8. hookService.executeStopHooks() — session stop hooks
  // 9. titleProvider.generateTitle() — auto-title for session
  // 10. sessionTranscript.recordTurn() — persist to transcript
  // 11. telemetryService.reportRequest() — telemetry
}
```

## Skill Architecture (6 Skills, ALL Features Required)

| Skill | Covers | Key Files |
|-------|--------|-----------|
| **quiz-vscode-core-ai** | Registration, services, endpoints, parsers, auth, telemetry, context, intents | `quiz.contribution.ts`, `quizServiceImpl.ts`, `quizAgent.ts` |
| **quiz-prompt-engineering** | Prompt building, conversation management, intent detection, model routing | `quizSystemPromptBuilder.ts`, `quizConversationManager.ts` |
| **quiz-agent-tools** | 30+ tool implementations, schemas, confirmations, layering | `quizToolsContribution.ts`, `readFileTool.ts`, `editFileTool.ts` |
| **quiz-chat-ui** | Chat panel, inline, quick, editor surfaces, branding, actions | `quizAgentView.ts`, `quizWidget.ts`, `quizStatusBar.ts` |
| **quiz-agent-runtime** | Tool calling loop, hooks, agent providers, autopilot, subagents | `quizToolCallingLoop.ts`, `quizHookService.ts`, `quizAgentTypes.ts` |
| **quiz-session-management** | Transcript, history builder, checkpoints, metadata, feedback, BYOK, embeddings, semantic search, completions, inline edits, debug logger, customization sync, external path confirmation, welcome, title, terminal fix, model access, quota | `quizSessionTranscript.ts`, `quizCheckpointService.ts`, `quizByokService.ts`, `quizEmbeddingsComputer.ts` |

**No feature is optional.** All subsystems listed in the deep audit must be implemented.

## NOT an Extension

Quiz does **not** use:
- `extensions/quiz/` directory
- `vscode.*` extension API
- `activate()` / `deactivate()`
- Extension manifest `contributes`
- Separate build process
- `@vscode/prompt-tsx` npm package

## Streaming Grammar（流式响应状态机）

对标 Copilot `prompt/common/streamingGrammar.ts`。解析流式 LLM 输出的状态机，检测工具调用边界、代码块转换等。

```typescript
// common/parser/quizStreamingGrammar.ts

export interface IQuizStreamToken<S> {
  state: S;
  transitionTo?: S;    // 状态转换时设置
  token: string;       // 匹配到的子串
}

/**
 * 流式响应语法状态机。
 * 给定初始状态和状态转换映射，在 deltaText 中查找触发转换的子串。
 * 用途：检测流式输出中的 tool_call 开始/结束、代码块边界、thinking 块等。
 */
export class QuizStreamingGrammar<S extends string | number> {
  public state: S;
  private accumulator = '';
  private currentEntries: [string, S][] = [];
  public readonly tokens: IQuizStreamToken<S>[] = [];

  constructor(
    initialState: S,
    private readonly grammar: Map<S, [string, S][]>,
  ) {
    this.state = initialState;
    this.currentEntries = grammar.get(initialState) ?? [];
  }

  /** 将 delta text 喂入状态机，返回产生的 token */
  feed(deltaText: string): IQuizStreamToken<S>[] {
    this.accumulator += deltaText;
    const newTokens: IQuizStreamToken<S>[] = [];

    while (this.accumulator.length > 0) {
      let earliestMatch: { index: number; entry: [string, S] } | undefined;
      for (const entry of this.currentEntries) {
        const idx = this.accumulator.indexOf(entry[0]);
        if (idx !== -1 && (!earliestMatch || idx < earliestMatch.index)) {
          earliestMatch = { index: idx, entry };
        }
      }

      if (!earliestMatch) break; // 无匹配，等待更多输入

      const [matchStr, nextState] = earliestMatch.entry;
      const before = this.accumulator.slice(0, earliestMatch.index);
      if (before) {
        const token: IQuizStreamToken<S> = { state: this.state, token: before };
        this.tokens.push(token);
        newTokens.push(token);
      }

      const token: IQuizStreamToken<S> = {
        state: this.state,
        transitionTo: nextState,
        token: matchStr,
      };
      this.tokens.push(token);
      newTokens.push(token);

      this.accumulator = this.accumulator.slice(earliestMatch.index + matchStr.length);
      this.state = nextState;
      this.currentEntries = this.grammar.get(nextState) ?? [];
    }

    return newTokens;
  }
}
```

## Chat Modes 集成（IChatModeService 注册）

Quiz 的 5 种 Agent 模式必须通过 VS Code Core 的 `IChatModeService` 注册为 chat modes。
对标 Core `chat/common/chatModes.ts` (27KB)。

```typescript
// browser/quizChatModes.contribution.ts
// 在 quiz.contribution.ts 中注册

// 注册 Quiz 的 5 种模式为 Core chat modes
// Core 的 IChatModeService.registerMode() 接口：
//   registerMode(mode: { name: string; description: string; icon: ThemeIcon;
//                        tools: string[]; isDefault?: boolean }): IDisposable;

// Ask 模式 → Core ChatModeKind.Ask
registerMode({
  name: 'Ask',
  description: 'Ask questions about code and concepts',
  icon: Codicon.comment,
  tools: ['quiz_askQuestions', 'quiz_searchWorkspaceSymbols', 'quiz_getErrors', 'quiz_readFile'],
  isDefault: true,
});

// Edit 模式 → Core ChatModeKind.Edit
registerMode({
  name: 'Edit',
  description: 'Edit code in the workspace',
  icon: Codicon.edit,
  tools: ['quiz_readFile', 'quiz_editFile', 'quiz_applyPatch', 'quiz_createFile', 'quiz_listDir', 'quiz_findFiles', 'quiz_findTextInFiles'],
});

// Agent 模式 → Core ChatModeKind.Agent
registerMode({
  name: 'Agent',
  description: 'Full autonomous agent with all tools',
  icon: Codicon.tools,
  tools: [/* ALL tools */],
});

// Challenge 模式 → Quiz 自定义 mode
registerMode({
  name: 'Challenge',
  description: 'Quiz challenge mode for interactive learning',
  icon: Codicon.book,
  tools: ['quiz_generateQuestions', 'quiz_evaluateAnswer', 'quiz_trackProgress', 'quiz_searchKnowledgeBase'],
});

// Review 模式 → Quiz 自定义 mode
registerMode({
  name: 'Review',
  description: 'Review code with quiz-style questions',
  icon: Codicon.eye,
  tools: ['quiz_readFile', 'quiz_getErrors', 'quiz_getScmChanges', 'quiz_askQuestions', 'quiz_generateQuestions', 'quiz_evaluateAnswer'],
});
```

## Agent Host Session Handler 模式

Quiz 必须实现 `IChatSession.requestHandler`，遵循 Core `agentSessions/agentHost/agentHostSessionHandler.ts` (122KB) 的模式。
这是 Core 路由请求到 agent host 的核心接口。

```typescript
// browser/quizSessionHandler.ts
// Quiz 的 IChatSession 实现

export class QuizChatSession extends Disposable implements IChatSession {
  readonly onWillDispose: Event<void>;
  readonly sessionResource: URI;
  readonly history: readonly IChatSessionHistoryItem[] = [];

  // 关键：requestHandler 是 Core 调用的入口
  requestHandler?: (
    request: IChatAgentRequest,
    progress: (progress: IChatProgress[]) => void,
    history: any[],
    token: CancellationToken
  ) => Promise<void>;

  // progress observable — Core 的 agentSessionsViewer 绑定此观察者
  readonly progressObs?: IObservable<IChatProgress[]>;
  readonly isCompleteObs?: IObservable<boolean>;
  readonly interruptActiveResponseCallback?: () => Promise<boolean>;

  // 服务端主动发起新请求（如排队消息消费后）
  readonly onDidStartServerRequest?: Event<{ prompt: string; variableData?: IChatRequestVariableData }>;

  constructor(
    @IQuizService private readonly quizService: IQuizService,
    @IQuizHookService private readonly hookService: IQuizHookService,
  ) {
    super();

    // 绑定 requestHandler → 调用 quizService.handleRequest()
    this.requestHandler = async (request, progress, history, token) => {
      await this.quizService.handleRequest({
        request,
        progressCallback: progress,
        history,
        sessionResource: this.sessionResource,
        token,
      });
    };
  }
}
```

## State → Progress Adapter

将内部 agent 状态转换为 `IChatProgress[]` 供 UI 渲染。这是 agent 执行和 UI 显示之间的关键桥梁。
对标 Core `agentSessions/agentHost/stateToProgressAdapter.ts` (1060 行)。

### 精确转换映射 (来自 Core stateToProgressAdapter.ts:323-357)

Core 的 `activeTurnToProgress()` 函数遍历 `ActiveTurn.responseParts`，按 `ResponsePartKind` 分发：

| ResponsePartKind | ToolCallStatus | → IChatProgress 类型 | 说明 |
|---|---|---|---|
| `Markdown` | — | `{ kind: 'markdownContent', content }` | 流式文本 |
| `Reasoning` | — | `{ kind: 'thinking', value }` | 推理/thinking |
| `ToolCall` | `Completed` / `Cancelled` | `IChatToolInvocationSerialized` | 已完成工具调用（历史回放） |
| `ToolCall` | `Running` / `Streaming` / `PendingConfirmation` | `ChatToolInvocation`（live 对象） | 进行中工具调用（可交互） |
| `ContentRef` | — | *(跳过)* | 内容引用不渲染 |

### Quiz 适配器实现

```typescript
// browser/quizStateToProgressAdapter.ts
// 对标 Core stateToProgressAdapter.ts:323-357 activeTurnToProgress()

import { ChatToolInvocation } from 'vs/workbench/contrib/chat/common/model/chatProgressTypes/chatToolInvocation';
import type { IChatProgress, IChatToolInvocationSerialized, IChatUsage } from 'vs/workbench/contrib/chat/common/chatService/chatService';

export function quizActiveTurnToProgress(
  sessionResource: URI,
  activeTurn: IQuizActiveTurn,
): IChatProgress[] {
  const parts: IChatProgress[] = [];

  // Usage → IChatUsage (对标 usageInfoToChatUsage)
  const usage = quizUsageToChatUsage(activeTurn.usage);
  if (usage) {
    parts.push(usage);
  }

  for (const rp of activeTurn.responseParts) {
    switch (rp.kind) {
      case 'markdown':
        if (rp.content) {
          parts.push({ kind: 'markdownContent', content: rp.content });
        }
        break;

      case 'reasoning':
        if (rp.content) {
          parts.push({ kind: 'thinking', value: rp.content });
        }
        break;

      case 'toolCall': {
        const tc = rp.toolCall;
        if (tc.status === 'completed' || tc.status === 'cancelled') {
          // 已完成 → 序列化形式（历史回放用）
          parts.push(quizCompletedToolCallToSerialized(tc, sessionResource));
        } else if (tc.status === 'running' || tc.status === 'streaming' || tc.status === 'pendingConfirmation') {
          // 进行中 → live ChatToolInvocation 对象（可交互，支持确认/取消）
          parts.push(quizToolCallStateToInvocation(tc, sessionResource));
        }
        break;
      }
    }
  }

  return parts;
}

// 已完成工具调用 → 序列化形式
// 对标 stateToProgressAdapter.ts:428- completedToolCallToSerialized()
function quizCompletedToolCallToSerialized(
  tc: IQuizCompletedToolCall,
  sessionResource: URI,
): IChatToolInvocationSerialized {
  const isSuccess = tc.status === 'completed' && tc.success;
  return {
    kind: 'toolInvocationSerialized',
    invocationMessage: tc.invocationMessage ?? `Running ${tc.toolName}...`,
    pastTenseInvocationMessage: isSuccess
      ? `Ran ${tc.toolName}`
      : `Failed to run ${tc.toolName}`,
    toolName: tc.toolName,
    toolCallId: tc.toolCallId,
    // 工具输入/输出详情
    inputOutput: tc.toolInput ? {
      input: tc.toolInput,
      inputLanguage: 'json',
      output: tc.output ? [{ type: 'embed', value: tc.output, isText: true, mimeType: 'text/plain' }] : [],
      isError: !isSuccess,
    } : undefined,
  };
}

// 进行中工具调用 → live ChatToolInvocation
// 对标 stateToProgressAdapter.ts toolCallStateToInvocation()
function quizToolCallStateToInvocation(
  tc: IQuizActiveToolCall,
  sessionResource: URI,
): ChatToolInvocation {
  const invocation = new ChatToolInvocation(
    tc.invocationMessage ?? `Running ${tc.toolName}...`,
    tc.confirmationMessages ? {
      title: tc.confirmationMessages.title,
      message: tc.confirmationMessages.message,
    } : undefined,
    tc.toolCallId,
  );

  // PendingConfirmation 状态需要用户确认
  if (tc.status === 'pendingConfirmation') {
    invocation.setConfirmationResult = (result: boolean) => {
      // 将确认结果路由回 Quiz agent loop
    };
  }

  return invocation;
}
```

### IChatProgress 类型体系 (Core chatService.ts)

Quiz 开发者必须了解 Core 的 `IChatProgress` 联合类型，这是所有 UI 渲染的数据源：

```typescript
// 关键 IChatProgress 类型（来自 Core chatService/chatService.ts）
type IChatProgress =
  | { kind: 'markdownContent'; content: IMarkdownString }        // 文本响应
  | { kind: 'thinking'; value: string }                          // 推理/thinking
  | { kind: 'toolInvocation'; invocation: ChatToolInvocation }   // 进行中工具调用
  | IChatToolInvocationSerialized                                 // 已完成工具调用
  | { kind: 'progressMessage'; progress: { message: string } }   // 进度消息
  | { kind: 'usage'; ... }                                       // Token 使用量
  | IChatWarningMessage                                           // 警告
  | IChatEditFileProgress                                         // 文件编辑进度
  ;
```

## Core Debug Service 集成

Quiz 应集成 Core 的 `IChatDebugService`（而非仅实现自己的 debug file logger）。
对标 Core `chat/common/chatDebugService.ts` (13KB) + `chatDebugServiceImpl.ts` (19KB) + `chatDebugEvents.ts` (6KB)。

```typescript
// Quiz 通过 Core 的 IChatDebugService 发送 debug 事件
// Core 的 debug service 已经有完整的事件体系：

// Core 的 chatDebugEvents.ts 定义的事件类型：
// - ChatRequestStartEvent    — 请求开始
// - ChatRequestEndEvent      — 请求结束
// - ChatToolCallEvent        — 工具调用
// - ChatToolResultEvent      — 工具结果
// - ChatStreamEvent          — 流式文本
// - ChatErrorEvent           — 错误

// Quiz 集成方式：
// 1. 在 quizServiceImpl.handleRequest() 中注入 IChatDebugService
// 2. 在请求生命周期关键点发送 debug 事件
// 3. Core 的 debug service 自动将事件路由到 output channel 和 debug view

// browser/quizDebugIntegration.ts
export class QuizDebugIntegration {
  constructor(
    @IChatDebugService private readonly chatDebugService: IChatDebugService,
  ) {}

  onRequestStart(request: IQuizChatRequest): void {
    this.chatDebugService.logEvent({
      type: 'requestStart',
      requestId: request.id,
      model: request.modelId,
      mode: request.mode,
    });
  }

  onToolCall(toolCall: IQuizToolCall): void {
    this.chatDebugService.logEvent({
      type: 'toolCall',
      toolName: toolCall.name,
      toolCallId: toolCall.id,
    });
  }
}
```

## Agent Host 子系统复用对照

Core `agentSessions/agentHost/` 下有 22 个文件，Quiz 需要明确哪些复用、哪些自实现：

| Core Agent Host 文件 | 大小 | Quiz 策略 | 说明 |
|---|---|---|---|
| `agentHostSessionHandler.ts` | 122KB | **Quiz 自实现** | Quiz 的 session handler 遵循此模式但独立实现 |
| `stateToProgressAdapter.ts` | 43KB | **Quiz 自实现** | 转换逻辑因 Quiz 的状态事件不同 |
| `agentHostChatContribution.ts` | 16KB | **Quiz 复用模式** | 参考注册方式，Quiz 用 `quiz.contribution.ts` |
| `agentHostSnapshotController.ts` | 16KB | **Quiz 复用** | Core 的快照控制器，Quiz 通过 `IChatEditingSession` 接入 |
| `agentHostUntitledProvisionalSessionService.ts` | 21KB | **Quiz 复用** | Core 的临时会话服务，Quiz 直接使用 |
| `agentHostSessionListController.ts` | 15KB | **Quiz 复用** | Core 的会话列表控制器 |
| `agentHostChatInputPicker.ts` | 23KB | **Quiz 复用** | Core 的输入选择器 |
| `agentHostCustomAgentPicker.ts` | 15KB | **Quiz 复用** | Core 的自定义 agent 选择器 |
| `agentHostGenericConfigChips.ts` | 9KB | **Quiz 复用** | Core 的配置芯片 UI |
| `agentHostTerminalContribution.ts` | 8KB | **Quiz 复用** | Core 的终端集成 |
| `agentHostWorkingDirectoryResolver.ts` | 2KB | **Quiz 复用** | Core 的工作目录解析 |
| `agentHostLocalCustomizations.ts` | 6KB | **Quiz 复用** | Core 的本地定制发现 |
| `agentHostAuth.ts` | 7KB | **Quiz 自实现** | Quiz 的认证逻辑不同（非 GitHub OAuth） |
| `agentHostLanguageModelProvider.ts` | 3KB | **Quiz 自实现** | Quiz 的 LM 提供者注册逻辑 |
| `agentCustomizationSyncProvider.ts` | 2KB | **Quiz 自实现** | Quiz 的定制同步 |
| `agentCustomizationItemProvider.ts` | 12KB | **Quiz 自实现** | Quiz 的定制项提供者 |
| `agentCustomizationContentExpander.ts` | 8KB | **Quiz 自实现** | Quiz 的定制内容展开 |
| `syncedCustomizationBundler.ts` | 6KB | **Quiz 自实现** | Quiz 的定制打包器 |
| `loggingAgentConnection.ts` | 12KB | **Quiz 不需要** | 仅用于远程 agent host 日志 |
| `agentHostPermissionUiContribution.ts` | 6KB | **Quiz 复用** | Core 的权限 UI 贡献 |

## Reference Documents

- **Complete file spec**: Read `references/quiz-complete-file-spec.md`
- **Copilot vs Core mapping**: Read `references/copilot-vs-core-mapping.md`
- **Directory layout**: Read `references/quiz-directory-structure.md`
- **VS Code Core chat**: Read `references/vscode-core-chat-architecture.md`
- **Copilot ext arch**: Read `references/copilot-chat-extension-architecture.md`
- **Migration plan**: Read `references/migration-plan.md`
- **Code map**: Read `references/code-map.md`
