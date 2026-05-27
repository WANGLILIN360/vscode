---
name: quiz-chat-ui
description: "Develop chat UI components for Quiz in VS Code Core contribution. Use when (1) Working with Quiz chat widget, view pane, or message list rendering, (2) Implementing Quiz inline chat in the editor, (3) Customizing Quiz quick chat floating panel, (4) Adding branding/styling to Quiz chat surfaces, (5) Implementing Quiz chat editing UI with Keep/Undo controls, (6) Creating Quiz chat input with attachments, (7) Adding Quiz chat actions, keybindings, or toolbar items, (8) Working with Quiz chat session tabs or mode selectors, (9) Rendering tool invocations or code blocks in Quiz responses, or (10) Registering Quiz chat views or containers."
---

# Quiz Chat UI

Develop chat UI components for Quiz in VS Code Core contribution at `src/vs/workbench/contrib/quiz/`.

## Three-Layer Architecture

Quiz UI follows VS Code Core's three-layer pattern:

| Layer | Path | Runs In | Contains |
|-------|------|---------|----------|
| **common/** | `contrib/quiz/common/ui/` | Both | UI type definitions, view id constants, mode enums |
| **browser/** | `contrib/quiz/browser/` | Both (Web + Desktop) | ViewPane, Widget, InputPart, Actions, CSS, all UI rendering |
| **electron-browser/** | `contrib/quiz/electron-browser/ui/` | Desktop only | Native UI integrations (OS notifications, tray icon, desktop shortcuts) |

Registered in:
- `browser/quiz.contribution.ts` — browser contribution entry
- `electron-browser/quiz.electron.contribution.ts` — electron contribution entry

Quiz is a Core contribution — not an extension. UI components extend Core chat widgets from `contrib/chat/browser/`.

## Chat Surfaces

Quiz provides 4 chat surfaces, reusing `contrib/chat/browser/` infrastructure:

| Surface | Quiz File | Reuses From |
|---|---|---|
| **Panel** | `browser/quizAgentView.ts` | `chat/browser/chatViewPane.ts` |
| **Inline** | `browser/quizInlineWidget.ts` | `inlineChat/browser/inlineChatWidget.ts` |
| **Quick** | `browser/quizQuickChat.ts` | `chat/browser/chatWidget.ts` |
| **Editor** | `browser/quizEditorChat.ts` | `chat/browser/chatWidget.ts` |

## Key Components

### QuizAgentView (extends ChatViewPane)

```typescript
// browser/quizAgentView.ts
// Quiz's main panel view. Extends ChatViewPane to provide
// Quiz-specific branding, welcome message, and mode options.
class QuizAgentView extends ChatViewPane {
  // Override to provide Quiz-specific widget options
  // - Welcome message with Quiz branding
  // - Quiz mode selector (Ask/Challenge/Review)
  // - Quiz-specific toolbar actions
}
```

### QuizWidget (configures ChatWidget)

```typescript
// browser/quizWidget.ts
// Quiz uses Core's ChatWidget, this file configures:
// - Quiz brand options (welcome message, placeholder text)
// - Binds Quiz agent to widget
// - Sets Quiz-specific mode options (Ask/Challenge/Review)
// - Does NOT subclass ChatWidget — just configures it
```

### QuizInputPart (configures ChatInputPart)

```typescript
// browser/quizInputPart.ts
// Quiz uses Core's ChatInputPart, this file configures:
// - Input box placeholder ("Ask Quiz...")
// - Quiz-specific tool picker buttons
// - Attachment type configuration
```

### QuizEditingWidget

```typescript
// browser/quizEditingWidget.ts
// Adapts Core's chatEditing system for Quiz:
// - Connects Quiz agent's edit results to Core's editing session
// - Configures Keep/Undo button text with Quiz branding
```

### QuizStatusBar

```typescript
// browser/quizStatusBar.ts
// Status bar icon for Quiz:
// - Shows Quiz connection status
// - Click opens Quiz Chat panel
// - Shows current model info
```

## View Registration

Quiz registers its view in `browser/quiz.contribution.ts`:

```typescript
// browser/quiz.contribution.ts
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry)
  .registerViews([{
    id: 'quiz.chatPanel',
    name: localize('quizChat', 'Quiz'),
    containerIcon: Codicon.book,
    ctorDescriptor: new SyncDescriptor(QuizAgentView),
  }], viewContainer);
```

## Actions

```typescript
// browser/actions/quizActions.ts
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: 'quiz.openChat',
      title: localize('openChat', 'Open Quiz Chat'),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }

  async run(accessor: ServicesAccessor): Promise<void> {
    const viewsService = accessor.get(IViewsService);
    await viewsService.openView(QUIZ_CHAT_VIEW_ID, true);
  }
});
```

## Branding

```typescript
const title = localize('quiz.chatTitle', 'Quiz Chat');
const placeholder = localize('quiz.inputPlaceholder', 'Ask Quiz...');
```

```css
/* browser/media/quiz.css */
.quiz-theme {
  --quiz-primary: #0078d4;
  --quiz-accent: #00bcf2;
}
```

## Directory Structure (Three-Layer)

```
contrib/quiz/
├── common/ui/                            # UI types (platform-agnostic)
│   ├── quizViewIds.ts                    # View ID constants (QUIZ_CHAT_VIEW_ID etc.)
│   ├── quizModeKind.ts                   # QuizModeKind enum
│   └── quizUiTypes.ts                    # UI interface definitions
├── browser/                              # UI implementations (Web + Desktop)
│   ├── quiz.contribution.ts              # Browser contribution entry
│   ├── media/quiz.css                    # Brand styles
│   ├── quizAgentView.ts                  # Chat panel ViewPane
│   ├── quizWidget.ts                     # ChatWidget configuration
│   ├── quizInputPart.ts                  # Input configuration
│   ├── quizInlineWidget.ts               # Inline chat widget
│   ├── quizQuickChat.ts                  # Quick chat floating panel
│   ├── quizEditorChat.ts                 # Editor chat
│   ├── quizEditingWidget.ts              # Keep/Undo editing
│   ├── quizStatusBar.ts                  # Status bar icon
│   └── actions/quizActions.ts            # Commands + keybindings
└── electron-browser/ui/                  # Native UI (Desktop only)
    ├── quizNativeStatusBar.ts            # OS-level status bar integration
    ├── quizNativeNotifications.ts        # OS notification integration
    └── quizDesktopShortcuts.ts           # Desktop shortcut registration
```

## Chat Modes

Quiz reuses Core's `ChatModeKind` and adds Quiz-specific modes:

```typescript
// Quiz extends Core's modes with learning-specific modes
enum QuizModeKind {
  Ask = ChatModeKind.Ask,       // Q&A mode
  Edit = ChatModeKind.Edit,     // Code editing mode
  Agent = ChatModeKind.Agent,   // Full agent mode
  Challenge = 'challenge',       // Quiz challenge mode (Quiz-specific)
  Review = 'review',            // Code review quiz mode (Quiz-specific)
}
```

## Quiz Context Keys 完整列表

Quiz 需要注册以下 context keys，用于菜单/工具栏/命令可见性控制。
对标 Core `chat/common/actions/chatContextKeys.ts` (30+ context keys)。

```typescript
// browser/contextKeys/quizContextKeys.contribution.ts

export namespace QuizContextKeys {
  // ── Quiz 可用性 ──
  export const available = new RawContextKey<boolean>('quizAvailable', false);
  export const enabled = new RawContextKey<boolean>('quizIsEnabled', false);

  // ── 当前模式 ──
  export const modeKind = new RawContextKey<QuizModeKind>('quizModeKind', QuizModeKind.Ask);
  export const modeName = new RawContextKey<string>('quizModeName', '');

  // ── 当前模型 ──
  export const modelId = new RawContextKey<string>('quizModelId', '');

  // ── 请求状态 ──
  export const requestInProgress = new RawContextKey<boolean>('quizRequestInProgress', false);
  export const hasActiveRequest = new RawContextKey<boolean>('quizHasActiveRequest', false);
  export const currentlyEditing = new RawContextKey<boolean>('quizCurrentlyEditing', false);
  export const currentlyEditingInput = new RawContextKey<boolean>('quizCurrentlyEditingInput', false);

  // ── 响应状态 ──
  export const responseVote = new RawContextKey<string>('quizResponseVote', '');
  export const responseHasError = new RawContextKey<boolean>('quizResponseHasError', false);
  export const responseIsFiltered = new RawContextKey<boolean>('quizResponseIsFiltered', false);
  export const responseSupportsIssueReporting = new RawContextKey<boolean>('quizResponseSupportsIssueReporting', false);

  // ── 输入状态 ──
  export const inputHasText = new RawContextKey<boolean>('quizInputHasText', false);
  export const inputHasFocus = new RawContextKey<boolean>('quizInputHasFocus', false);
  export const inQuizInput = new RawContextKey<boolean>('inQuizInput', false);
  export const inQuizSession = new RawContextKey<boolean>('inQuizSession', false);

  // ── 权限级别 ──
  export const permissionLevel = new RawContextKey<QuizPermissionLevel>('quizPermissionLevel', QuizPermissionLevel.Default);

  // ── Session 类型 ──
  export const sessionType = new RawContextKey<string>('quizSessionType', 'local');

  // ── 编辑请求类型 ──
  export const editingRequestType = new RawContextKey<string>('quizEditingSentRequest', undefined);

  // ── Chat item ──
  export const isResponse = new RawContextKey<boolean>('quizIsResponse', false);
  export const isRequest = new RawContextKey<boolean>('quizIsRequest', false);
  export const isFirstRequest = new RawContextKey<boolean>('quizIsFirstRequest', false);
  export const isPendingRequest = new RawContextKey<boolean>('quizIsPendingRequest', false);
  export const itemId = new RawContextKey<string>('quizItemId', '');

  // ── 编辑状态 ──
  export const editApplied = new RawContextKey<boolean>('quizEditApplied', false);
}
```

## Chat Editing Session 集成

Quiz 的 `editFileTool` 必须与 Core 的 `IChatEditingSession` 集成，实现 Keep/Undo 功能。
对标 Core `chatEditing/chatEditingSession.ts` (48KB) + `chatEditingCodeEditorIntegration.ts` (33KB)。

```typescript
// Quiz 的 editFileTool 执行后，必须通知 IChatEditingSession：
// 1. 调用 IChatEditingSession.addFileEdit() 注册编辑
// 2. Core 自动在编辑器中显示 diff 装饰
// 3. 用户可以 Keep（接受）或 Undo（撤销）每个编辑
// 4. Core 的 chatEditingCheckpointTimeline 提供时间线 UI

// 集成路径：
// editFileTool.invoke()
//   → IFileService.writeFile()           // 实际写入文件
//   → IChatEditingSession.addFileEdit()  // 注册到编辑会话
//   → Core 自动渲染 diff + Keep/Undo UI

// 关键接口：
// IChatEditingSession {
//   addFileEdit(uri: URI, edit: ITextEdit): void;
//   accept(uri: URI): Promise<void>;     // Keep
//   reject(uri: URI): Promise<void>;     // Undo
//   onDidChange: Event<void>;
// }
```

## Chat Artifact System

Quiz 复用 Core 的 Artifact 系统。对标 Core `chat/common/chatArtifactExtraction.ts` + `chat/common/tools/chatArtifactsService.ts`。

```typescript
// Core 的 Artifact 系统已经内置：
// - setArtifactsTool — 在对话中创建 artifact（代码块、图表等）
// - setArtifactRulesTool — 设置 artifact 规则
// - chatArtifactsService — 管理 artifact 生命周期
//
// Quiz 不需要独立实现，只需确保：
// 1. Quiz 的 Agent 模式包含 setArtifactsTool 和 setArtifactRulesTool
// 2. Quiz 的 Challenge 模式可以使用 artifact 展示题目和代码
// 3. Quiz 的 Review 模式可以使用 artifact 展示代码审查结果
```

## 其他 Core UI 集成点

| Core 子系统 | 文件 | Quiz 集成方式 |
|---|---|---|
| **Chat Image** | `chat/common/chatImageExtraction.ts` (8.7KB) | Quiz 复用 Core 的图片附件处理 |
| **Chat Perf** | `chat/common/chatPerf.ts` (4KB) | Quiz 在关键路径添加 perf marker |
| **Chat Enablement** | `chat/common/enablement.ts` (5.1KB) | Quiz 注册 enablement 条件（quizIsEnabled context key） |
| **Voice Chat** | `chat/common/voiceChatService.ts` (9.4KB) | Quiz 复用 Core 的语音输入（如果可用） |
| **AI Customization Workspace** | `chat/common/aiCustomizationWorkspaceService.ts` (7.5KB) | Quiz 通过 `ICustomizationHarnessService` 接入 |
| **Chat Editing Notebook** | `chatEditing/notebook/` (9 items) | Quiz 复用 Core 的 notebook 编辑集成 |
| **Chat Editing Checkpoint Timeline** | `chatEditing/chatEditingCheckpointTimeline*.ts` | Quiz 复用 Core 的时间线 UI |
| **Chat Editing Editor Overlay** | `chatEditing/chatEditingEditorOverlay.ts` (15KB) | Quiz 复用 Core 的编辑器覆盖层 |
| **Chat Editing Explanation** | `chatEditing/chatEditingExplanationWidget.ts` (22KB) | Quiz 复用 Core 的编辑解释 UI |
| **Language Model Stats** | `chat/common/languageModelStats.ts` (2.7KB) | Quiz 通过 Core 的 `ILanguageModelStatsService` 上报使用统计 |
| **Working Directory** | `chat/common/workingDirectory.ts` (2.2KB) | Quiz 设置工作目录上下文 |
| **Chat Todo List** | `chat/common/tools/chatTodoListService.ts` (4KB) | Quiz 复用 Core 的 Todo 列表服务 |

## _observeTurn 模式 (对标 AgentHostSessionHandler)

这是 Quiz SessionHandler 与 Core Chat UI 的**核心绑定机制**。对标 `agentHostSessionHandler.ts` (3028 行) 的 `_observeTurn()` 方法。

### 工作原理

Core 的 `IChatSession` 通过 `progressObs: IObservable<IChatProgress[]>` 将 agent 状态变化推送到 UI。`_observeTurn` 使用 `autorun` 订阅 `ActiveTurn` 的 observable state，每次 state 变化时：

1. 调用 `activeTurnToProgress()` 将 state 转为 `IChatProgress[]`
2. 通过 `sink` 回调推送到 UI
3. 管理 `ChatToolInvocation` 生命周期（确认/取消交互）

```typescript
// browser/quizSessionHandler.ts — 对标 agentHostSessionHandler.ts:120-3028
// 核心方法: _observeTurn()

private _observeTurn(options: IQuizObserveTurnOptions): void {
  const { sink, cancellationToken, turnId } = options;

  // ── 1. 使用 autorun 订阅 ActiveTurn observable ──
  // 对标 agentHostSessionHandler.ts:1650-1750
  const store = new DisposableStore();
  store.add(autorun(reader => {
    if (cancellationToken.isCancellationRequested) return;

    const activeTurn = this._activeTurns.read(reader)?.get(turnId);
    if (!activeTurn) return;

    // ── 2. 转换 state → IChatProgress[] ──
    // 对标 stateToProgressAdapter.ts activeTurnToProgress()
    const progress = quizActiveTurnToProgress(
      options.sessionResource,
      activeTurn,
    );

    // ── 3. 处理 ToolInvocation 生命周期 ──
    // 进行中的工具调用需要创建/更新 ChatToolInvocation 对象
    for (const part of progress) {
      if (part.kind === 'toolInvocation') {
        const invocation = part.invocation as ChatToolInvocation;
        if (invocation.needsConfirmation) {
          // 设置确认回调 → 路由到 agent loop
          invocation.setConfirmationResult = (confirmed: boolean) => {
            this._dispatchAction({
              type: confirmed ? ActionType.ToolCallConfirmed : ActionType.ToolCallRejected,
              toolCallId: invocation.toolCallId,
            });
          };
        }
      }
    }

    // ── 4. 推送到 UI ──
    sink(progress);

    // ── 5. 检查 turn 是否结束 ──
    if (activeTurn.state === 'completed' || activeTurn.state === 'failed') {
      options.onTurnEnded?.(activeTurn);
      store.dispose();
    }
  }));
}

// ── IObserveTurnOptions ──
// 对标 agentHostSessionHandler.ts:85-104
interface IQuizObserveTurnOptions {
  readonly backendSession: URI;
  readonly sessionResource: URI;
  readonly turnId: string;
  readonly sink: (parts: IChatProgress[]) => void;
  readonly cancellationToken: CancellationToken;
  readonly adoptInvocations?: ReadonlyMap<string, ChatToolInvocation>;
  readonly seedEmittedLengths?: ReadonlyMap<string, number>;
  readonly onTurnEnded?: (lastTurn: IQuizActiveTurn | undefined) => void;
  readonly onFileEdits?: (tc: IQuizToolCallState, fileEdits: IQuizToolCallFileEdit[]) => void;
  readonly subAgentInvocationId?: string;
}
```

### 三种 Turn 观察场景

| 场景 | sink 目标 | 说明 |
|---|---|---|
| **Live** (`_handleTurn`) | Agent invoke callback | 用户发送请求时的实时响应 |
| **Reconnect** (`provideChatSessionContent`) | `chatSession.appendProgress` | 重新加载窗口后恢复历史 |
| **Server-initiated** (`_watchForServerInitiatedTurns`) | `chatSession.appendProgress` | 服务端主动发起的请求 |

### Client Actions (用户交互 → Agent Loop)

Quiz 必须实现以下 `SessionAction` 分发，对标 `agentHostSessionHandler.ts` 的 `_dispatchAction()`:

```typescript
// 用户交互 → 路由到 agent loop
type QuizClientAction =
  | { type: ActionType.TurnStarted }                    // 用户发送请求
  | { type: ActionType.ToolCallConfirmed; toolCallId }  // 用户确认工具调用
  | { type: ActionType.ToolCallRejected; toolCallId }   // 用户拒绝工具调用
  | { type: ActionType.TurnCancelled }                  // 用户取消请求
  | { type: ActionType.InputCompleted; answer }         // 用户回答问题
  ;
```

## Reference Documents

- **UI details**: Read `references/chat-ui-reference.md` for full component architecture, rendering patterns, and branding integration points
