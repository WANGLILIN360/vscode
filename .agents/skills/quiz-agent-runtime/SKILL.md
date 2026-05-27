---
name: quiz-agent-runtime
description: "Implement the Quiz AI agent runtime in VS Code Core — the execution engine that drives tool calling loops, hooks, agent lifecycle, and subagent delegation. Use when (1) Implementing the core tool calling loop that sends requests to LLM, parses responses, executes tools, and loops, (2) Working with chat hooks (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop), (3) Implementing agent mode providers (Ask, Edit, Agent, Challenge, Review), (4) Building tool call round tracking and token usage accounting, (5) Implementing autopilot mode with task_complete enforcement, (6) Handling cancellation, error recovery, and rate limits in the agent loop, (7) Integrating thinking/reasoning data from model responses (including encrypted thinking blocks and reasoning tokens), (8) Implementing subagent delegation and orchestration, (9) Working with IToolCallRound, IToolCall, Conversation, TurnStatus types, (10) Building the request lifecycle from handleRequest through intent classification to tool loop completion, (11) Implementing special request types (tool call limit extension, continue-on-error, auto-switch on rate limit), (12) Implementing the chat permission/auto-approval system for tool execution, or (13) Handling multi-phase agent execution with stateful markers and compaction data."
---

# Quiz Agent Runtime

Implement the Quiz AI agent runtime engine in VS Code Core at `src/vs/workbench/contrib/quiz/`.

## What This Skill Covers

This is the **execution engine** of the Quiz agent — the code that actually runs the AI conversation loop. It is the most critical subsystem, equivalent to Copilot's `toolCallingLoop.ts` (87KB) + `chatHookService.ts` (21KB) + `chatParticipants.ts` (17KB) + `agentTypes.ts` (4KB) = **~130KB** of core logic.

Other skills handle:
- **quiz-vscode-core-ai**: Registration, services, interfaces, session handler wiring
- **quiz-prompt-engineering**: Prompt building, conversation management, intent detection
- **quiz-agent-tools**: Individual tool implementations
- **quiz-chat-ui**: UI widgets and views
- **quiz-session-management**: Session persistence, checkpoints, metadata, feedback

This skill handles: **the runtime that ties them all together**.

## Directory Structure

```
contrib/quiz/
├── common/agentLoop/                    # Core loop (platform-agnostic)
│   ├── quizToolCallingLoop.ts           # THE core agent loop
│   ├── quizToolCallRound.ts             # Tool call round tracking
│   ├── quizAutopilotManager.ts          # Autopilot mode + task_complete
│   ├── quizLoopTypes.ts                 # Loop option/result types
│   ├── quizThinkingData.ts              # Thinking/reasoning data handling
│   ├── quizSpecialRequestTypes.ts       # Tool call limit, continue-on-error, rate-limit auto-switch
│   └── quizTurnStatus.ts                # Turn status enum + TurnMessage types
├── common/hooks/                        # Hook system interfaces
│   ├── quizHookService.ts               # IQuizHookService interface
│   ├── quizHookTypes.ts                 # Hook type definitions
│   └── quizHookExecutor.ts              # IQuizHookExecutor interface
├── common/agents/                        # Agent type definitions
│   ├── quizAgentTypes.ts                # Agent mode enums + config types
│   ├── quizAgentProvider.ts             # IQuizAgentProvider interface
│   ├── quizAgentLifecycle.ts            # Agent lifecycle states
│   └── quizChatPermissionService.ts     # Tool auto-approval + permission levels
├── browser/agentLoop/                    # Browser implementations
│   └── quizToolCallingLoopImpl.ts       # Concrete loop implementation
├── browser/hooks/                        # Hook implementations
│   ├── quizHookServiceImpl.ts           # Hook service implementation
│   └── quizHookResultProcessor.ts       # Process hook results
├── browser/agents/                       # Agent providers
│   ├── quizAskAgentProvider.ts          # Ask mode agent
│   ├── quizEditAgentProvider.ts         # Edit mode agent
│   ├── quizAgentModeAgentProvider.ts    # Agent mode (full tool access)
│   ├── quizChallengeAgentProvider.ts    # Challenge mode (Quiz-specific)
│   └── quizReviewAgentProvider.ts       # Review mode (Quiz-specific)
├── electron-browser/agentLoop/          # Native loop (Node.js optimized)
│   └── quizNativeToolCallingLoop.ts     # Node.js optimized loop (direct fs/git access)
├── electron-browser/hooks/              # Native hook implementations
│   ├── quizNativeHookServiceImpl.ts     # Shell-based hook execution (child_process)
│   └── quizShellHookExecutor.ts         # Shell command hook executor
└── electron-browser/agents/             # Native agent providers
    └── quizNativeAgentProvider.ts        # Native agent with direct Node.js tool access
```

## Core: Tool Calling Loop

The tool calling loop is the **heart of the agent**. It implements the ReAct (Reason-Act) pattern:

```
User Query → Build Prompt → Send to LLM → Parse Response
    ↑                                              │
    │                              ┌───────────────┤
    │                              │               │
    │                         Tool Calls?      No Tool Calls
    │                              │               │
    │                   Execute Tools              │
    │                   Run Hooks                  │
    │                   Add Results                │
    │                              │               │
    └──────────────────────────────┘         → Done
```

### quizToolCallingLoop.ts (Abstract Base)

对标 Copilot `toolCallingLoop.ts` (1882 行) 的精确架构。核心设计：

- **`run()`** → 入口，创建 OTel span，调用 `_runLoop()`
- **`_runLoop()`** → `while(true)` 主循环，调用 `runOne()`
- **`runOne()`** → 单次迭代：buildPrompt → fetch → parseResponse → return round
- **双流架构**：`FetchStreamSource`（原始 LLM 流）+ `ResponseProcessor`（UI 流）

```typescript
// common/agentLoop/quizToolCallingLoop.ts
// 精确对标 Copilot toolCallingLoop.ts (1882 行)

export const enum ToolCallLimitBehavior {
  Confirm,  // Ask user if they want to continue
  Stop,     // Hard stop the loop
}

export interface IQuizToolCallingLoopOptions {
  conversation: IQuizConversation;
  toolCallLimit: number;
  onHitToolCallLimit?: ToolCallLimitBehavior;
  streamParticipants?: IQuizResponseStreamParticipant[];
  responseProcessor?: IQuizResponseProcessor;
  request: IQuizChatRequest;
  yieldRequested?: () => boolean;
}

export abstract class QuizToolCallingLoop extends Disposable {
  private toolCallResults: Record<string, IQuizToolResult> = {};
  private toolCallRounds: IQuizToolCallRound[] = [];
  private stopHookReason: string | undefined;
  private additionalHookContext: string | undefined;
  private taskCompleted = false;
  private autopilotRetryCount = 0;
  private autopilotIterationCount = 0;
  private autopilotStopHookActive = false;
  private autopilotProgressDeferred: DeferredPromise<void> | undefined;

  private static readonly MAX_AUTOPILOT_RETRIES = 3;
  private static readonly MAX_AUTOPILOT_ITERATIONS = 5;
  private static readonly TASK_COMPLETE_TOOL_NAME = 'task_complete';

  // Events
  private readonly _onDidBuildPrompt = this._register(new Emitter<IQuizToolCallingBuiltPromptEvent>());
  private readonly _onDidReceiveResponse = this._register(new Emitter<IQuizToolCallingResponseEvent>());

  // Abstract methods subclasses must implement
  protected abstract buildPrompt(
    context: IQuizBuildPromptContext,
    progress: IProgress<IQuizProgressPart>,
    token: CancellationToken
  ): Promise<IQuizBuildPromptResult>;

  protected abstract getAvailableTools(
    outputStream: IQuizResponseStream | undefined,
    token: CancellationToken
  ): Promise<IQuizToolInfo[]>;

  protected abstract fetch(
    options: IQuizLoopFetchOptions,
    token: CancellationToken
  ): Promise<IQuizChatResponse>;

  // ── run(): 入口方法 ──
  // 对标 toolCallingLoop.ts:705-855
  // 创建 OTel span，累积 token usage，调用 _runLoop()
  public async run(
    outputStream: IQuizResponseStream | undefined,
    token: CancellationToken
  ): Promise<IQuizLoopResult> {
    // OTel span: invoke_agent + token usage accumulation
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const tokenListener = this.onDidReceiveResponse(({ response }) => {
      if (response.type === 'success' && response.usage) {
        totalInputTokens += response.usage.prompt_tokens || 0;
        totalOutputTokens += response.usage.completion_tokens || 0;
      }
    });

    try {
      const result = await this._runLoop(outputStream, token);
      return result;
    } finally {
      tokenListener.dispose();
    }
  }

  // ── _runLoop(): 主循环 ──
  // 对标 toolCallingLoop.ts:857-1158
  private async _runLoop(
    outputStream: IQuizResponseStream | undefined,
    token: CancellationToken
  ): Promise<IQuizLoopResult> {
    let i = 0;
    let lastResult: IQuizToolCallSingleResult | undefined;
    let stopHookActive = false;

    while (true) {
      // ── Tool call limit check ──
      // 对标 toolCallingLoop.ts:870-881
      if (lastResult && i++ >= this.options.toolCallLimit) {
        // Autopilot: 自动扩展限制到 200 (3/2 倍递增)
        const permLevel = this.options.request.permissionLevel;
        if (permLevel === 'autopilot' && this.options.toolCallLimit < 200) {
          this.options.toolCallLimit = Math.min(
            Math.round(this.options.toolCallLimit * 3 / 2), 200
          );
          this.showAutopilotProgress(outputStream,
            'Extending tool call limit with Autopilot...',
            'Extended tool call limit with Autopilot'
          );
        } else {
          lastResult = this.hitToolCallLimit(outputStream, lastResult);
          break;
        }
      }

      // ── Yield check ──
      // 对标 toolCallingLoop.ts:883-889
      // Autopilot: 不 yield 直到 task_complete
      if (lastResult && this.options.yieldRequested?.()) {
        if (this.options.request.permissionLevel !== 'autopilot' || this.taskCompleted) {
          break;
        }
      }

      try {
        // ── 单次迭代 ──
        const result = await this.runOne(outputStream, i, token);
        lastResult = result;
        this.toolCallRounds.push(result.round);

        // ── Inline summarization ──
        // 对标 toolCallingLoop.ts:911-1046
        // 如果模型请求了 inline summarization 且没有 tool calls
        if (result.inlineSummarizationRequested && !result.round.toolCalls.length) {
          const summaryText = this.extractInlineSummary(result.round.response);
          if (summaryText !== undefined) {
            // 将 summary 应用到之前的 round，移除 summarization round
            this.applySummaryToRound(summaryText);
            this.toolCallRounds.pop();
            continue; // 继续循环
          }
        }

        // ── Autopilot: 重置 nudge 计数 ──
        if (this.autopilotStopHookActive && result.round.toolCalls.length
            && !result.round.toolCalls.some(tc => tc.name === 'task_complete')) {
          this.autopilotStopHookActive = false;
          this.autopilotIterationCount = 0;
        }

        // ── 无 tool calls → 检查是否应该停止 ──
        if (!result.round.toolCalls.length || result.response.type !== 'success') {
          if (token.isCancellationRequested) break;

          // Auto-retry in autopilot mode (对标 toolCallingLoop.ts:1062-1072)
          if (result.response.type !== 'success' && this.shouldAutoRetry(result.response)) {
            this.autopilotRetryCount++;
            await timeout(1000, token);
            continue;
          }

          // Stop hook (对标 toolCallingLoop.ts:1074-1110)
          const stopHookResult = await this.executeStopHook(
            { stop_hook_active: stopHookActive }, outputStream, token
          );
          if (stopHookResult.shouldContinue && stopHookResult.reasons?.length) {
            this.stopHookReason = stopHookResult.reasons.join('; ');
            result.round.hookContext = this.formatHookContext(stopHookResult.reasons);
            stopHookActive = true;
            continue;
          }

          // Autopilot internal stop hook (对标 toolCallingLoop.ts:1112-1124)
          if (this.options.request.permissionLevel === 'autopilot'
              && result.response.type === 'success') {
            const autopilotContinue = this.shouldAutopilotContinue(result);
            if (autopilotContinue) {
              this.stopHookReason = autopilotContinue;
              this.autopilotStopHookActive = true;
              continue;
            }
          }

          break; // 真正完成
        }
      } catch (e) {
        if (isCancellationError(e) && lastResult) break;
        throw e;
      }
    }

    return { ...lastResult, toolCallRounds: this.toolCallRounds, toolCallResults: this.toolCallResults };
  }

  // ── runOne(): 单次迭代 ──
  // 对标 toolCallingLoop.ts:1276-1566
  public async runOne(
    outputStream: IQuizResponseStream | undefined,
    iterationNumber: number,
    token: CancellationToken
  ): Promise<IQuizToolCallSingleResult> {
    // 1. Get available tools
    let availableTools = await this.getAvailableTools(outputStream, token);
    availableTools = this.ensureAutopilotTools(availableTools);

    // 2. Build prompt context
    const context = this.createPromptContext(availableTools, outputStream);
    const buildPromptResult = await this.buildPrompt(context, outputStream, token);

    // 3. Token counting
    const promptTokenLength = await this.countTokens(buildPromptResult.messages);
    this._onDidBuildPrompt.fire({ result: buildPromptResult, tools: availableTools, promptTokenLength });

    // 4. FetchStreamSource + ResponseProcessor 双流架构
    //    对标 toolCallingLoop.ts:1382-1397
    const fetchStreamSource = new FetchStreamSource();
    let processResponsePromise: Promise<ChatResult | void> | undefined;
    let stopEarly = false;

    if (outputStream) {
      processResponsePromise = this.responseProcessor.processResponse(
        undefined, fetchStreamSource.stream, outputStream, token
      );
      processResponsePromise.finally(() => { stopEarly = true; });
    }

    // 5. Fetch from LLM
    const toolCalls: IQuizToolCall[] = [];
    let thinkingItem: IQuizThinkingDataItem | undefined;
    const fetchResult = await this.fetch({
      messages: buildPromptResult.messages,
      finishedCb: async (text, index, delta) => {
        fetchStreamSource?.update(text, delta);
        if (delta.toolCalls) {
          toolCalls.push(...delta.toolCalls);
        }
        if (delta.thinking) {
          thinkingItem = ThinkingDataItem.createOrUpdate(thinkingItem, delta.thinking);
        }
        return stopEarly ? text.length : undefined;
      },
      requestOptions: {
        tools: availableTools.map(t => ({
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
          type: 'function',
        })),
      },
    }, token);

    // 6. Finalize streams
    fetchStreamSource?.resolve();
    const chatResult = await processResponsePromise;

    // 7. Report usage to UI
    if (fetchResult.type === 'success' && fetchResult.usage && outputStream) {
      outputStream.usage({
        completionTokens: fetchResult.usage.completion_tokens,
        promptTokens: fetchResult.usage.prompt_tokens,
      });
    }

    // 8. Build result
    return {
      response: fetchResult,
      round: QuizToolCallRound.create({
        response: fetchResult.value,
        toolCalls,
        thinking: thinkingItem,
      }),
      chatResult,
      availableTools,
    };
  }

  // ── Autopilot: should continue? ──
  // 对标 toolCallingLoop.ts:367-402
  protected shouldAutopilotContinue(result: IQuizToolCallSingleResult): string | undefined {
    if (this.taskCompleted) return undefined;
    const calledTaskComplete = this.toolCallRounds.some(
      round => round.toolCalls.some(tc => tc.name === 'task_complete')
    );
    if (calledTaskComplete) { this.taskCompleted = true; return undefined; }
    if (this.autopilotIterationCount >= QuizToolCallingLoop.MAX_AUTOPILOT_ITERATIONS) return undefined;
    this.autopilotIterationCount++;
    return 'You have not yet marked the task as complete using the task_complete tool. '
      + 'You must call task_complete when done — whether the task involved code changes, '
      + 'answering a question, or any other interaction.\n\n'
      + 'Do NOT repeat or restate your previous response. Pick up where you left off.\n\n'
      + 'IMPORTANT: Do NOT call task_complete if:\n'
      + '- You have open questions or ambiguities — make good decisions and keep working\n'
      + '- You encountered an error — try to resolve it or find an alternative approach\n'
      + '- There are remaining steps — complete them first';
  }

  // ── Auto-retry logic ──
  // 对标 toolCallingLoop.ts:455-472
  private shouldAutoRetry(response: IQuizChatResponse): boolean {
    const permLevel = this.options.request.permissionLevel;
    if (permLevel !== 'autoApprove' && permLevel !== 'autopilot') return false;
    if (this.autopilotRetryCount >= QuizToolCallingLoop.MAX_AUTOPILOT_RETRIES) return false;
    switch (response.type) {
      case 'rateLimited': case 'quotaExceeded': case 'canceled': case 'offTopic':
        return false;
      default:
        return response.type !== 'success';
    }
  }
}
```

### Autopilot Mode (已集成到主 Loop)

Autopilot 逻辑已直接集成到 `_runLoop()` 中（对标 Copilot `toolCallingLoop.ts`），不需要单独的 Manager 类。关键行为：

- **`permissionLevel === 'autopilot'`** 时激活
- **`task_complete` 工具**：`ensureAutopilotTools()` 确保始终可用
- **自动扩展 toolCallLimit**：以 3/2 倍递增，上限 200
- **内部 stop hook**：模型未调用 `task_complete` 就停止时，自动 nudge 继续
- **Auto-retry**：非 rate-limited/quota/cancel 错误时自动重试（最多 3 次）
- **不 yield**：`yieldRequested()` 时 autopilot 不退出（直到 task_complete）

```typescript
// common/agentLoop/quizAutopilotManager.ts
// 轻量辅助类，仅提取 ensureAutopilotTools 和 nudge 文本

export class QuizAutopilotManager {
  ensureAutopilotTools(availableTools: IQuizToolInfo[]): IQuizToolInfo[] {
    if (availableTools.some(t => t.name === 'task_complete')) return availableTools;
    return [...availableTools, this.getTaskCompleteTool()];
  }
}
```

## Core: Hook System

Hooks run at specific points in the agent lifecycle, allowing external logic to intercept and modify behavior.

### Hook Types

```typescript
// common/hooks/quizHookTypes.ts
export const enum QuizHookType {
  SessionStart = 'SessionStart',       // When a chat session begins
  SessionEnd = 'SessionEnd',           // When a chat session ends
  UserPromptSubmit = 'UserPromptSubmit', // When user submits a prompt
  PreToolUse = 'PreToolUse',           // Before each tool invocation
  PostToolUse = 'PostToolUse',         // After each tool invocation
  PreCompact = 'PreCompact',           // Before context compaction
  SubagentStart = 'SubagentStart',     // When a subagent begins
  SubagentStop = 'SubagentStop',       // When a subagent ends
  Stop = 'Stop',                       // When the agent tries to stop
  ErrorOccurred = 'ErrorOccurred',     // When an error occurs
}

export interface IQuizSessionStartHookInput {
  readonly source: string;
}
export interface IQuizSessionStartHookOutput {
  readonly hookSpecificOutput?: { additionalContext?: string };
}

export interface IQuizPreToolUseHookInput {
  readonly toolName: string;
  readonly toolArgs: Record<string, unknown>;
}
export interface IQuizPreToolUseHookOutput {
  readonly hookSpecificOutput?: {
    decision: 'allow' | 'block';
    reason?: string;
    modifiedArgs?: Record<string, unknown>;
  };
}

export interface IQuizPostToolUseHookInput {
  readonly toolName: string;
  readonly toolArgs: Record<string, unknown>;
  readonly toolResult: IQuizToolResult;
}
export interface IQuizPostToolUseHookOutput {
  readonly hookSpecificOutput?: {
    modifiedResult?: IQuizToolResult;
    additionalMessage?: string;
  };
}

export interface IQuizStopHookInput {
  readonly stop_hook_active: boolean;
}
export interface IQuizStopHookOutput {
  readonly hookSpecificOutput?: {
    decision: 'allow' | 'block';
    reason?: string;
  };
}

export interface IQuizSubagentStartHookInput {
  readonly agent_id: string;
  readonly agent_type: string;
}
export interface IQuizSubagentStopHookInput {
  readonly agent_id: string;
  readonly agent_type: string;
  readonly stop_hook_active: boolean;
}
```

### Hook Service Interface

```typescript
// common/hooks/quizHookService.ts
export const IQuizHookService = createDecorator<IQuizHookService>('quizHookService');

export interface IQuizHookService {
  readonly _serviceBrand: undefined;

  executeHook(
    hookType: QuizHookType,
    hookConfig: IQuizHookConfig | undefined,
    input: unknown,
    sessionId: string,
    token: CancellationToken
  ): Promise<IQuizHookResult[]>;

  registerHookProvider(provider: IQuizHookProvider): IDisposable;
}

export interface IQuizHookProvider {
  readonly hookType: QuizHookType;
  execute(input: unknown, token: CancellationToken): Promise<unknown>;
}
```

### Hook Result Processor

```typescript
// browser/hooks/quizHookResultProcessor.ts
export function processHookResults(options: {
  hookType: QuizHookType;
  results: IQuizHookResult[];
  outputStream: IQuizResponseStream | undefined;
  logService: ILogService;
  onSuccess: (output: unknown) => void;
  onError?: (errorMessage: string) => void;
  ignoreErrors?: boolean;
}): void {
  for (const result of options.results) {
    if (result.exitCode === 0) {
      options.onSuccess(result.output);
    } else if (!options.ignoreErrors) {
      options.onError?.(result.stderr || `Hook exited with code ${result.exitCode}`);
    }
  }
}
```

## Core: Agent Types & Providers

### Agent Mode Types

```typescript
// common/agents/quizAgentTypes.ts
export const enum QuizAgentMode {
  Ask = 'ask',           // Q&A, no file edits
  Edit = 'edit',         // Code editing mode
  Agent = 'agent',       // Full agent with all tools
  Challenge = 'challenge', // Quiz challenge mode (Quiz-specific)
  Review = 'review',     // Code review quiz mode (Quiz-specific)
}

export interface IQuizAgentConfig {
  readonly mode: QuizAgentMode;
  readonly displayName: string;
  readonly description: string;
  readonly icon: Codicon;
  readonly defaultIntent: QuizIntent;
  readonly tools: readonly QuizToolId[];
  readonly instructions: string;
  readonly supportsFileEdits: boolean;
  readonly supportsTerminal: boolean;
  readonly maxToolCallRounds: number;
}

// Agent configurations — each mode has its own tool set and instructions
export const QuizAgentConfigs: Record<QuizAgentMode, IQuizAgentConfig> = {
  [QuizAgentMode.Ask]: {
    mode: QuizAgentMode.Ask,
    displayName: 'Ask',
    description: 'Ask questions about code and concepts',
    icon: Codicon.comment,
    defaultIntent: QuizIntent.Ask,
    tools: [QuizToolId.AskQuestions, QuizToolId.SearchWorkspaceSymbols, QuizToolId.GetErrors, QuizToolId.ReadFile],
    instructions: 'You are in Ask mode. Answer questions about code. Do not edit files.',
    supportsFileEdits: false,
    supportsTerminal: false,
    maxToolCallRounds: 5,
  },
  [QuizAgentMode.Edit]: {
    mode: QuizAgentMode.Edit,
    displayName: 'Edit',
    description: 'Edit code in the workspace',
    icon: Codicon.edit,
    defaultIntent: QuizIntent.Edit,
    tools: [QuizToolId.ReadFile, QuizToolId.EditFile, QuizToolId.ApplyPatch, QuizToolId.CreateFile, QuizToolId.ListDir, QuizToolId.FindFiles, QuizToolId.FindTextInFiles],
    instructions: 'You are in Edit mode. Edit code files as requested.',
    supportsFileEdits: true,
    supportsTerminal: false,
    maxToolCallRounds: 10,
  },
  [QuizAgentMode.Agent]: {
    mode: QuizAgentMode.Agent,
    displayName: 'Agent',
    description: 'Full autonomous agent with all tools',
    icon: Codicon.tools,
    defaultIntent: QuizIntent.Agent,
    tools: [/* ALL tools */],
    instructions: 'You are in Agent mode. You have access to all tools. Work autonomously to complete tasks.',
    supportsFileEdits: true,
    supportsTerminal: true,
    maxToolCallRounds: 30,
  },
  [QuizAgentMode.Challenge]: {
    mode: QuizAgentMode.Challenge,
    displayName: 'Challenge',
    description: 'Quiz challenge mode for interactive learning',
    icon: Codicon.book,
    defaultIntent: QuizIntent.Challenge,
    tools: [QuizToolId.GenerateQuestions, QuizToolId.EvaluateAnswer, QuizToolId.TrackProgress, QuizToolId.SearchKnowledgeBase],
    instructions: 'You are in Challenge mode. Generate quiz questions and evaluate answers. Adapt difficulty based on performance.',
    supportsFileEdits: false,
    supportsTerminal: false,
    maxToolCallRounds: 15,
  },
  [QuizAgentMode.Review]: {
    mode: QuizAgentMode.Review,
    displayName: 'Review',
    description: 'Review code with quiz-style questions',
    icon: Codicon.eye,
    defaultIntent: QuizIntent.Review,
    tools: [QuizToolId.ReadFile, QuizToolId.GetErrors, QuizToolId.GetScmChanges, QuizToolId.AskQuestions, QuizToolId.GenerateQuestions, QuizToolId.EvaluateAnswer],
    instructions: 'You are in Review mode. Review code and create quiz questions about the codebase to test understanding.',
    supportsFileEdits: false,
    supportsTerminal: false,
    maxToolCallRounds: 10,
  },
};
```

### Agent Provider Interface

```typescript
// common/agents/quizAgentProvider.ts
export const IQuizAgentProvider = createDecorator<IQuizAgentProvider>('quizAgentProvider');

export interface IQuizAgentProvider {
  readonly _serviceBrand: undefined;

  getAgentConfig(mode: QuizAgentMode): IQuizAgentConfig;
  createToolCallingLoop(mode: QuizAgentMode, options: IQuizToolCallingLoopOptions): QuizToolCallingLoop;
  getAvailableToolsForMode(mode: QuizAgentMode): Promise<IQuizToolInfo[]>;
}
```

### Agent Lifecycle

```typescript
// common/agents/quizAgentLifecycle.ts
export const enum QuizAgentLifecycleState {
  Idle = 'idle',
  Starting = 'starting',
  Running = 'running',
  WaitingForConfirmation = 'waitingForConfirmation',
  ExecutingTool = 'executingTool',
  Completing = 'completing',
  Error = 'error',
  Cancelled = 'cancelled',
}

export interface IQuizAgentLifecycleManager {
  readonly state: QuizAgentLifecycleState;
  readonly onDidChangeState: Event<QuizAgentLifecycleState>;
  transitionTo(state: QuizAgentLifecycleState): void;
}
```

## Tool Call Round Tracking

```typescript
// common/agentLoop/quizToolCallRound.ts
export interface IQuizToolCallRound {
  readonly id: string;
  readonly toolCalls: readonly IQuizToolCall[];
  readonly results: Record<string, IQuizToolResult>;
  readonly tokenUsage: IQuizTokenUsage;
  readonly timestamp: number;
  readonly duration: number;
  readonly hookResults?: IQuizHookResult[];
  // ── 新增字段（Copilot toolCallRound.ts 对齐） ──
  readonly response: string;                    // 本轮助手文本回复
  readonly toolInputRetry: number;               // 工具输入验证失败重试次数
  readonly statefulMarker?: string;              // OpenAI Responses API stateful marker（用于多轮状态追踪）
  readonly compaction?: IQuizCompactionData;      // 上下文窗口压缩数据（OpenAI context management response）
  readonly thinking?: IQuizThinkingData;          // 模型思考/推理数据
  readonly phase?: string;                       // 多阶段 agent 当前阶段名（如 'planning', 'executing'）
  readonly phaseModelId?: string;                // 当前阶段使用的模型 ID（多模型 agent）
  readonly summary?: string;                     // 本轮摘要（用于 compaction 后恢复上下文）
}

export interface IQuizToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface IQuizTokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;       // 推理/思考 token 数（来自 thinking blocks）
  readonly cachedTokens?: number;           // 缓存命中 token 数（prompt caching）
}

// 上下文窗口压缩数据 — 当模型返回 compaction 指令时使用
export interface IQuizCompactionData {
  readonly compactedMessages: IQuizChatMessage[];  // 压缩后的消息列表
  readonly retainedPriority: PromptPriority;       // 保留的优先级阈值
  readonly compactionRatio: number;                // 压缩比例 (0-1)
}

export class QuizToolCallRoundTracker {
  private rounds: IQuizToolCallRound[] = [];

  addRound(round: IQuizToolCallRound): void {
    this.rounds.push(round);
  }

  getTotalTokenUsage(): IQuizTokenUsage {
    return this.rounds.reduce((acc, r) => ({
      promptTokens: acc.promptTokens + r.tokenUsage.promptTokens,
      completionTokens: acc.completionTokens + r.tokenUsage.completionTokens,
      totalTokens: acc.totalTokens + r.tokenUsage.totalTokens,
    }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  }

  getRounds(): readonly IQuizToolCallRound[] { return this.rounds; }
  getRoundCount(): number { return this.rounds.length; }
}
```

## Thinking/Reasoning Data

模型返回的思考/推理数据，包括加密思考块和推理 token 计数。
对标 Copilot `platform/thinking/common/thinking.ts` + `prompt/common/toolCallRound.ts#ThinkingDataItem`。

```typescript
// common/agentLoop/quizThinkingData.ts

export interface IQuizThinkingData {
  readonly id: string;
  readonly text: string | string[];     // 推理文本（可能是流式累积的数组）
  readonly metadata?: Record<string, unknown>;
  readonly tokens?: number;             // 推理 token 数（从 fetch result 更新）
  readonly encrypted?: string;          // 加密思考块（某些模型返回加密推理）
}

export interface IQuizThinkingDelta {
  readonly id?: string;
  readonly text?: string | string[];    // 增量推理文本
  readonly metadata?: Record<string, unknown>;
  readonly encrypted?: string;          // 加密增量
}

export class QuizThinkingDataItem implements IQuizThinkingData {
  public text: string | string[] = '';
  public metadata?: Record<string, unknown>;
  public tokens?: number;
  public encrypted?: string;

  constructor(public id: string) {}

  static createOrUpdate(item: QuizThinkingDataItem | undefined, delta: IQuizThinkingDelta): QuizThinkingDataItem {
    if (!item) {
      item = new QuizThinkingDataItem(delta.id ?? generateUuid());
    }
    item.update(delta);
    return item;
  }

  update(delta: IQuizThinkingDelta): void {
    if (delta.id && this.id !== delta.id) { this.id = delta.id; }
    if (delta.encrypted) { this.encrypted = delta.encrypted; }
    if (delta.text !== undefined) {
      if (Array.isArray(delta.text)) {
        this.text = Array.isArray(this.text) ? [...this.text, ...delta.text]
          : this.text ? [this.text, ...delta.text] : [...delta.text];
      } else {
        this.text = Array.isArray(this.text) ? [...this.text, delta.text] : this.text + delta.text;
      }
    }
    if (delta.metadata) { this.metadata = delta.metadata; }
  }

  updateWithTokenCount(reasoningTokens: number | undefined): void {
    this.tokens = reasoningTokens;
  }
}
```

## Special Request Types

工具调用循环中的特殊确认流程。对标 Copilot `prompt/common/specialRequestTypes.ts`。
这些是用户在循环执行过程中可能遇到的确认对话框。

```typescript
// common/agentLoop/quizSpecialRequestTypes.ts

// ── 工具调用轮次上限扩展 ──
// 当 agent 达到 toolCallLimit 时，询问用户是否继续
export interface IQuizToolCallIterationIncrease {
  quizRequestedRoundLimit: number;
}

export const getRequestedToolCallIterationLimit = (request: IQuizChatRequest) =>
  request.acceptedConfirmationData?.find(
    (c): c is IQuizToolCallIterationIncrease => !!(c && typeof c.quizRequestedRoundLimit === 'number')
  )?.quizRequestedRoundLimit;

export const isToolCallLimitCancellation = (request: IQuizChatRequest) =>
  !!request.rejectedConfirmationData?.find(
    (c): c is IQuizToolCallIterationIncrease => !!(c && typeof c.quizRequestedRoundLimit === 'number')
  );

export const isToolCallLimitAcceptance = (request: IQuizChatRequest) =>
  !!getRequestedToolCallIterationLimit(request) && !isToolCallLimitCancellation(request);

// ── 错误后继续 ──
// 当工具执行出错时，询问用户是否继续（而非直接终止）
export interface IQuizContinueOnErrorConfirmation {
  quizContinueOnError: true;
}

export const isContinueOnError = (request: IQuizChatRequest) =>
  !!(request.acceptedConfirmationData?.some(
    (c): c is IQuizContinueOnErrorConfirmation => !!(c && (c as IQuizContinueOnErrorConfirmation).quizContinueOnError === true)
  ));

// ── 速率限制时自动切换 ──
// 当遇到 rate limit 时，询问用户是否切换到 auto-approve 模式
export interface IQuizSwitchToAutoOnRateLimitConfirmation {
  quizSwitchToAutoOnRateLimit: true;
  alwaysSwitchToAuto: boolean;  // "以后都自动切换"选项
}

export const getSwitchToAutoOnRateLimitConfirmation = (request: IQuizChatRequest) =>
  request.acceptedConfirmationData?.find(
    (c): c is IQuizSwitchToAutoOnRateLimitConfirmation =>
      !!(c && (c as IQuizSwitchToAutoOnRateLimitConfirmation).quizSwitchToAutoOnRateLimit === true)
  );

export const isSwitchToAutoOnRateLimit = (request: IQuizChatRequest) =>
  !!(request.acceptedConfirmationData?.some(
    (c): c is IQuizSwitchToAutoOnRateLimitConfirmation =>
      !!(c && (c as IQuizSwitchToAutoOnRateLimitConfirmation).quizSwitchToAutoOnRateLimit === true)
  ));

// 确认对话框文本
export const quizCancelText = () => '暂停';
```

## Turn Status & Message Types

对话轮次状态和消息类型。对标 Copilot `prompt/common/conversation.ts` 的 `TurnStatus` + `TurnMessage`。

```typescript
// common/agentLoop/quizTurnStatus.ts

export const enum QuizTurnStatus {
  InProgress = 'in-progress',
  Success = 'success',
  Cancelled = 'cancelled',
  OffTopic = 'off-topic',         // 新增：用户问题超出范围
  Filtered = 'filtered',           // 新增：响应被内容过滤拦截
  PromptFiltered = 'prompt-filtered', // 新增：用户输入被过滤
  Error = 'error',
}

// 对话消息类型 — 每条消息的类型标记
export type QuizTurnMessage = {
  readonly type: 'user' | 'follow-up' | 'template' | 'offtopic-detection' | 'model' | 'meta' | 'server';
  readonly name?: string;          // agent 名称（model 类型时使用）
  /* readonly */ message: string;   // 消息内容（非 readonly 因为 compaction 可能修改）
};

// 请求调试信息 — 关联到 debug service
export class QuizRequestDebugInformation {
  constructor(
    readonly uri: URI,
    readonly intentId: string,
    readonly toolCallRounds: readonly IQuizToolCallRound[],
  ) {}
}
```

## Chat Permission System

工具自动审批/权限系统。对标 VS Code Core `chat/common/chatPermissionWarnings.ts` + `ChatPermissionLevel` context key。

```typescript
// common/agents/quizChatPermissionService.ts

export const enum QuizPermissionLevel {
  Default = 'default',       // 每次需要确认
  FullAuto = 'fullAuto',     // 全自动批准（仅限安全工具）
}

export interface IQuizChatPermissionService {
  readonly _serviceBrand: undefined;

  // 当前权限级别
  readonly permissionLevel: QuizPermissionLevel;
  readonly onDidChangePermissionLevel: Event<QuizPermissionLevel>;

  // 检查工具是否需要确认
  shouldConfirmToolCall(toolName: string, args: Record<string, unknown>): boolean;

  // 记住用户选择（本次会话）
  rememberApproval(toolName: string, scope: 'session' | 'always'): void;

  // 检查是否已批准
  isApproved(toolName: string): boolean;

  // 存储键（持久化到 storage）
  getPermissionStorageKey(toolName: string): string;
}

// 工具权限分类
export const enum QuizToolPermissionCategory {
  Safe = 'safe',               // 只读操作：readFile, listDir, findFiles, getErrors
  Destructive = 'destructive',  // 写操作：editFile, createFile, applyPatch, terminal
  External = 'external',       // 外部访问：fetchWebPage, installExtension
}

// 工具 → 权限分类映射
export const QuizToolPermissionMap: Record<string, QuizToolPermissionCategory> = {
  quiz_readFile: QuizToolPermissionCategory.Safe,
  quiz_listDir: QuizToolPermissionCategory.Safe,
  quiz_findFiles: QuizToolPermissionCategory.Safe,
  quiz_findTextInFiles: QuizToolPermissionCategory.Safe,
  quiz_getErrors: QuizToolPermissionCategory.Safe,
  quiz_searchWorkspaceSymbols: QuizToolPermissionCategory.Safe,
  quiz_editFile: QuizToolPermissionCategory.Destructive,
  quiz_createFile: QuizToolPermissionCategory.Destructive,
  quiz_createDirectory: QuizToolPermissionCategory.Destructive,
  quiz_applyPatch: QuizToolPermissionCategory.Destructive,
  quiz_terminal: QuizToolPermissionCategory.Destructive,
  quiz_notebook: QuizToolPermissionCategory.Destructive,
  quiz_fetchWebPage: QuizToolPermissionCategory.External,
  quiz_installExtension: QuizToolPermissionCategory.External,
  quiz_runVscodeCommand: QuizToolPermissionCategory.Destructive,
};
```

## Loop Types

```typescript
// common/agentLoop/quizLoopTypes.ts
export interface IQuizLoopResult {
  readonly status: 'completed' | 'cancelled' | 'error' | 'rateLimited' | 'toolCallLimitReached';
  readonly toolCallRounds: readonly IQuizToolCallRound[];
  readonly totalTokenUsage: IQuizTokenUsage;
  readonly error?: Error;
  readonly stopHookReasons?: string[];
}

export interface IQuizLoopFetchOptions {
  messages: IQuizChatMessage[];
  finishedCb: (response: IQuizChatResponse) => void;
  requestOptions: IQuizRequestOptions;
  userInitiatedRequest: boolean;
  turnId: string;
  enableThinking?: boolean;
  reasoningEffort?: string;
}

export interface IQuizBuildPromptContext {
  requestId: string;
  query: string;
  history: readonly IQuizConversationTurn[];
  toolCallResults: Record<string, IQuizToolResult>;
  toolCallRounds: readonly IQuizToolCallRound[];
  isContinuation: boolean;
  hasStopHookQuery: boolean;
  additionalHookContext?: string;
  tools: {
    toolReferences: readonly IQuizToolReference[];
    availableTools: readonly IQuizToolInfo[];
  };
}

export interface IQuizBuildPromptResult {
  messages: IQuizChatMessage[];
  requestOptions: IQuizRequestOptions;
  tokenCount: number;
}
```

## Integration Points

The runtime integrates with other Quiz subsystems:

| Subsystem | Integration Point |
|-----------|------------------|
| **quiz-vscode-core-ai** | `quizServiceImpl.ts` calls `toolCallingLoop.run()` |
| **quiz-prompt-engineering** | Loop calls `buildPrompt()` which uses prompt builders |
| **quiz-agent-tools** | Loop calls `executeToolCall()` which invokes tool implementations |
| **quiz-session-management** | Loop records turns in `sessionTranscript` |
| **IChatSessionsService** | Session handler delegates to `quizServiceImpl.handleRequest()` |

## Reference Documents

- **Tool calling loop**: Read `references/tool-calling-loop-reference.md` for detailed Copilot → Quiz migration patterns
- **Hook system**: Read `references/hook-system-reference.md` for hook lifecycle and execution patterns
- **Agent types**: Read `references/agent-types-reference.md` for agent mode configurations
