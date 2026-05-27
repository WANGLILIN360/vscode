---
name: quiz-agent-tools
description: "Implement Quiz AI assistant tools in VS Code Core. Use when (1) Creating a new tool for Quiz agent mode, (2) Migrating Copilot Chat extension tools to VS Code Core contribution, (3) Implementing tool confirmation dialogs and approval flows, (4) Designing tool schemas and result formats, (5) Adding file operations (read, edit, create) as agent tools, (6) Adding terminal command execution tools, (7) Adding search/navigation tools, (8) Working with IToolData, IToolImpl, IToolInvocation, or IToolResult interfaces, or (9) Building tool invocation UI in the Quiz chat browser layer. IMPORTANT: Tools requiring Node.js APIs MUST go in electron-browser/tools/, NOT common/tools/."
---

# Quiz Agent Tools

Implement tools for Quiz agent mode in VS Code Core contribution at `src/vs/workbench/contrib/quiz/`.

## ⚠️ Critical: Tool Layering

Tools MUST be layered by platform dependency:

| Layer | Location | What Goes Here |
|-------|----------|---------------|
| **Common** | `common/quizToolIds.ts` | Tool ID enum only |
| **Browser** | `browser/tools/` | Tools that work with Web APIs (fetch, DOM, VS Code service APIs) |
| **Electron** | `electron-browser/tools/` | Tools that need Node.js (fs, child_process, glob, ripgrep) |

**Wrong:** Putting readFile, editFile, terminal in `common/tools/` — they need Node.js!
**Right:** They go in `electron-browser/tools/`. Browser gets quiz-specific tools only.

## Three-Layer Directory Structure

```
contrib/quiz/
├── common/                            # Platform-agnostic
│   └── quizToolIds.ts                 # Tool ID enum only
├── browser/tools/                     # Browser-safe tools (Web APIs)
│   ├── quizToolsContribution.ts       # Registration contribution
│   ├── generateQuestionsTool.ts
│   ├── evaluateAnswerTool.ts
│   ├── trackProgressTool.ts
│   ├── searchKnowledgeBaseTool.ts
│   ├── getErrorsTool.ts
│   ├── searchWorkspaceSymbolsTool.ts
│   ├── manageTodoListTool.ts
│   ├── askQuestionsTool.ts
│   ├── confirmationTool.ts
│   └── switchAgentTool.ts
└── electron-browser/tools/            # Node.js tools (Desktop only)
    ├── nativeQuizToolsContribution.ts # Registration contribution
    ├── readFileTool.ts
    ├── listDirTool.ts
    ├── editFileTool.ts
    ├── createFileTool.ts
    ├── createDirectoryTool.ts
    ├── findFilesTool.ts
    ├── findTextInFilesTool.ts
    ├── terminalTool.ts
    ├── notebookTool.ts
    ├── applyPatchTool.ts
    ├── getScmChangesTool.ts
    ├── fetchWebPageTool.ts
    ├── viewImageTool.ts
    ├── codebaseSearchTool.ts
    ├── testFailureTool.ts
    ├── installExtensionTool.ts
    ├── runVscodeCommandTool.ts
    ├── memoryTool.ts
    ├── searchSubagentTool.ts
    └── executionSubagentTool.ts
```

## Tool Interface (from Core's ILanguageModelToolsService)

```typescript
// These interfaces are from contrib/chat/common/tools/languageModelToolsService.ts
import { IToolData, IToolImpl, IToolResult, IToolInvocation, IToolInvocationPreparationContext, IPreparedToolInvocation, IToolConfirmationMessages, CountTokensCallback, ToolProgress } from 'vs/workbench/contrib/chat/common/tools/languageModelToolsService';

// IToolData — tool metadata (id, source, name, description, inputSchema, when, icon)
// IToolImpl — tool implementation (invoke, prepareToolInvocation, handleToolStream)
// IToolResult — tool result (content with text, promptTsx, or data parts)
// IToolInvocation — invocation with parameters, callId, toolId
// IToolInvocationPreparationContext — context for prepareToolInvocation (parameters, toolCallId, sessionResource)
// IPreparedToolInvocation — confirmation + presentation before execution
// IToolConfirmationMessages — title/message pair for user confirmation
```

## Complete Tool List

### Browser-Safe Tools (`browser/tools/`)

| Tool | ID | Description | Confirmation |
|------|----|-------------|-------------|
| GenerateQuestions | `quiz_generateQuestions` | Generate quiz questions from code/docs | No |
| EvaluateAnswer | `quiz_evaluateAnswer` | Evaluate user answer to quiz question | No |
| TrackProgress | `quiz_trackProgress` | Track learning progress + spaced repetition | No |
| SearchKnowledgeBase | `quiz_searchKnowledgeBase` | Search KB (browser-safe API) | No |
| GetErrors | `quiz_getErrors` | Get diagnostics via IMarkerService | No |
| SearchWorkspaceSymbols | `quiz_searchWorkspaceSymbols` | Symbol search via IWorkspaceSymbolService | No |
| ManageTodoList | `quiz_manageTodoList` | Todo list management | No |
| AskQuestions | `quiz_askQuestions` | Interactive questions to user | No |
| Confirmation | `quiz_confirmation` | Yes/No confirmation | No |
| SwitchAgent | `quiz_switchAgent` | Switch between Ask/Challenge/Review | No |

### Electron-Only Tools (`electron-browser/tools/`)

| Tool | ID | Description | Confirmation |
|------|----|-------------|-------------|
| ReadFile | `quiz_readFile` | Read file (Node fs, 2000-line chunks) | Yes (external paths) |
| ListDir | `quiz_listDir` | List directory (Node fs) | Yes (external paths) |
| EditFile | `quiz_editFile` | Edit file (diff/patch) | Yes |
| CreateFile | `quiz_createFile` | Create new file | Yes |
| CreateDirectory | `quiz_createDirectory` | Create directory | Yes |
| FindFiles | `quiz_findFiles` | Glob file search | No |
| FindTextInFiles | `quiz_findTextInFiles` | Ripgrep text search | No |
| Terminal | `quiz_runInTerminal` | Terminal execution + output capture | Yes |
| Notebook | `quiz_editNotebook` | Notebook cell operations | Yes |
| ApplyPatch | `quiz_applyPatch` | Unified diff patch application | Yes |
| GetScmChanges | `quiz_getScmChanges` | Git changed files | No |
| FetchWebPage | `quiz_fetchWebPage` | HTTP fetch (Node) | Yes |
| ViewImage | `quiz_viewImage` | Image viewing | No |
| CodebaseSearch | `quiz_codebaseSearch` | Semantic codebase search | No |
| TestFailure | `quiz_testFailure` | Test failure analysis | No |
| InstallExtension | `quiz_installExtension` | Install VS Code extension | Yes |
| RunVscodeCommand | `quiz_runVscodeCommand` | Execute VS Code command | Yes |
| Memory | `quiz_memory` | Persistent memory/context | No |
| SearchSubagent | `quiz_searchSubagent` | Fast codebase search subagent | No |
| ExecutionSubagent | `quiz_executionSubagent` | Execution subagent loop | Yes |

## Quick Start: New Tool

```typescript
// 1. Add ID to common/quizToolIds.ts
export const enum QuizToolId {
  MyTool = 'quiz_myTool',
}

// 2. Create tool file in correct layer
// browser/tools/myTool.ts (if browser-safe) OR
// electron-browser/tools/myTool.ts (if needs Node.js)

import { IToolData, IToolImpl, IToolResult, IToolInvocation, IToolInvocationPreparationContext, IPreparedToolInvocation, IToolConfirmationMessages, CountTokensCallback, ToolProgress } from '../../chat/common/tools/languageModelToolsService';
import { QuizToolId } from '../../common/quizToolIds';

const MyToolData: IToolData = {
  id: QuizToolId.MyTool,
  toolReferenceName: 'myTool',
  displayName: 'My Tool',
  icon: Codicon.book,
  userDescription: 'What this tool does',
  modelDescription: 'Detailed instructions for the LLM on how to use this tool',
  source: { type: 'builtin' },
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'What this parameter does' }
    },
    required: ['param']
  },
};

class MyToolImpl implements IToolImpl {
  async invoke(invocation: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { param } = invocation.parameters as any;
    // Implementation
    return { content: [{ kind: 'text', value: 'result' }] };
  }

  async prepareToolInvocation(context: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
    const { param } = context.parameters as any;
    return {
      invocationMessage: `Running MyTool on ${param}`,
      confirmationMessages: {
        title: `Confirm: ${param}`,
        message: `Will process ${param}`
      } satisfies IToolConfirmationMessages,
    };
  }
}

// 3. Register in the contribution file for the correct layer
// browser/tools/quizToolsContribution.ts OR
// electron-browser/tools/nativeQuizToolsContribution.ts
```

## Tool Confirmation Pattern

Tools that modify files or execute commands MUST confirm with the user:

```typescript
async prepareToolInvocation(context: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
  const { filePath } = context.parameters as any;
  return {
    invocationMessage: localize('quiz.readFile.running', "Reading {0}", filePath),
    confirmationMessages: {
      title: localize('quiz.readFile.confirm', "Read file: {0}", filePath),
      message: localize('quiz.readFile.confirmMessage', "Will read the contents of {0}", filePath)
    } satisfies IToolConfirmationMessages,
  };
}
```

For external path confirmation (files outside workspace), also register with `ILanguageModelToolsConfirmationService`:

```typescript
// See electron-browser/builtInTools/tools.ts in contrib/chat/ for the pattern
this._register(confirmationService.registerConfirmationContribution(
  'quiz_readFile',
  new ChatExternalPathConfirmationContribution(...)
));
```

## Schema Design Tips

- Use `description` fields — LLM reads them to understand parameters
- Add `enum` for constrained choices
- Use `default` for optional parameters
- Mark required fields with `required` array
- Keep schemas simple and clear
- `modelDescription` should explain when and how to use the tool

## Tool Result Compressor

当工具返回大量结果时，需要压缩以适应上下文窗口。对标 Core `chat/common/tools/toolResultCompressor.ts` (5.6KB)。

```typescript
// common/tools/quizToolResultCompressor.ts

export const IQuizToolResultCompressor = createDecorator<IQuizToolResultCompressor>('quizToolResultCompressor');

export interface IQuizToolResultCompressor {
  readonly _serviceBrand: undefined;

  /**
   * 压缩工具结果以适应上下文窗口。
   * 策略：
   * 1. 截断超长文本（保留头尾，中间用 ... 代替）
   * 2. 移除重复内容
   * 3. 对代码文件保留关键行（函数签名、类定义、import）
   * 4. 对搜索结果保留 top-K
   */
  compress(result: IQuizToolResult, maxTokens: number): IQuizToolResult;

  /**
   * 估算工具结果的 token 数
   */
  estimateTokens(result: IQuizToolResult): number;
}

export class QuizToolResultCompressor implements IQuizToolResultCompressor {
  private static readonly MAX_LINES_PER_FILE = 200;
  private static readonly MAX_SEARCH_RESULTS = 20;
  private static readonly CHARS_PER_TOKEN = 4; // 粗略估算

  compress(result: IQuizToolResult, maxTokens: number): IQuizToolResult {
    const estimatedTokens = this.estimateTokens(result);
    if (estimatedTokens <= maxTokens) return result;

    // 截断策略：保留前 100 行 + 后 50 行
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const lines = text.split('\n');
    if (lines.length > QuizToolResultCompressor.MAX_LINES_PER_FILE) {
      const head = lines.slice(0, 100);
      const tail = lines.slice(-50);
      const truncated = [...head, `... (${lines.length - 150} lines truncated) ...`, ...tail];
      return { ...result, content: truncated.join('\n') };
    }

    return result;
  }

  estimateTokens(result: IQuizToolResult): number {
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    return Math.ceil(text.length / QuizToolResultCompressor.CHARS_PER_TOKEN);
  }
}
```

## URL Fetching Confirmation

`quiz_fetchWebPageTool` 必须注册 URL 抓取确认，对标 Core `chat/common/tools/builtinTools/chatUrlFetchingConfirmation.ts` (11.6KB) + `chatUrlFetchingPatterns.ts` (5.5KB)。

```typescript
// electron-browser/confirmation/quizUrlFetchingConfirmation.ts
// 注册到 ILanguageModelToolsConfirmationService

// Core 的 URL 抓取确认模式：
// 1. 内部 URL（localhost, 127.0.0.1, vscode-extensions）→ 自动批准
// 2. 已知安全域名（github.com, npmjs.com）→ 自动批准
// 3. 其他外部 URL → 弹出确认对话框

// 注册方式（在 quiz.electron.contribution.ts 中）：
this._register(confirmationService.registerConfirmationContribution(
  'quiz_fetchWebPage',
  new ChatUrlFetchingConfirmationContribution(
    // 自动批准的 URL 模式
    [
      /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/,  // 本地服务
      /^https?:\/\/[^/]*\.github\.com/,                   // GitHub
      /^https?:\/\/[^/]*\.npmjs\.com/,                    // npm
      /^vscode-extension:\/\//,                             // VS Code 扩展
    ],
    // 需要确认的 URL 模式
    [
      /^https?:\/\/.*/,  // 所有其他 HTTP URL
    ]
  )
));
```

## Tool Permission Category 集成

工具的权限分类必须与 `quiz-agent-runtime` 的 `IQuizChatPermissionService` 联动。
每个工具的 `prepareToolInvocation()` 应检查权限级别：

```typescript
// 工具实现中的权限检查模式
async prepareToolInvocation(
  context: IToolInvocationPreparationContext,
  token: CancellationToken
): Promise<IPreparedToolInvocation | undefined> {
  const permissionService = this.permissionService; // IQuizChatPermissionService

  // 1. 检查是否已批准
  if (permissionService.isApproved(this.toolId)) {
    return undefined; // 无需确认
  }

  // 2. 检查权限级别
  if (permissionService.permissionLevel === QuizPermissionLevel.FullAuto) {
    const category = QuizToolPermissionMap[this.toolId];
    if (category === QuizToolPermissionCategory.Safe) {
      return undefined; // 安全工具自动批准
    }
    // Destructive/External 工具即使在 FullAuto 下也需确认
  }

  // 3. 需要确认
  return {
    confirmationMessages: {
      title: this.getConfirmationTitle(context.parameters),
      message: this.getConfirmationMessage(context.parameters),
    } satisfies IToolConfirmationMessages,
  };
}
```

## Reference Documents

- **Full tool system**: Read `references/tool-system-reference.md` for complete interfaces, patterns, and best practices
