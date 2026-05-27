# quiz Agent Tool System Reference

## Overview

The tool system enables quiz agent to perform actions in the workspace. Tools are invoked by the language model with JSON parameters, executed by VS Code Core, and results are returned to the model.

## Tool Architecture

```
User Request -> LLM -> Tool Call (JSON params) -> Tool Execution -> Result -> LLM -> Response
```

## Core Interfaces

### IChatTool (common/tools/)

```typescript
// Note: These are Quiz-adapted interfaces. The actual Core interfaces are in
// contrib/chat/common/tools/languageModelToolsService.ts
// Key differences from Core's IToolImpl:
//   - Core uses prepareToolInvocation (not prepareInvocation)
//   - Core's invoke takes (IToolInvocation, CountTokensCallback, ToolProgress, CancellationToken)
//   - Core's IToolResult.content uses `kind` not `type`
//   - Core's IToolConfirmationMessages has title + message (not array)

interface IChatTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: IJSONSchema;        // JSON Schema for parameters
  readonly tags?: string[];                 // Categorization tags
  readonly isBuiltin?: boolean;             // Core-provided vs extension

  invoke(options: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult>;
  prepareToolInvocation?(context: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined>;
}
```

### IToolInvocation

```typescript
// Note: Core's actual IToolInvocation has these fields:
interface IToolInvocation {
  callId: string;
  toolId: string;
  parameters: Record<string, unknown>;  // Note: `parameters`, not `input`
  toolSpecificData?: unknown;
  sessionResource?: URI;
}
```

### IToolResult

```typescript
// Note: Core's actual IToolResult uses `kind` not `type`, and has no `status`
interface IToolResult {
  content: (IToolResultPromptTsxPart | IToolResultTextPart | IToolResultDataPart)[];
  toolResultMessage?: string | IMarkdownString;
  toolResultDetails?: Array<URI | Location> | IToolResultInputOutputDetails;
  toolResultError?: string | boolean;
}

interface IToolResultTextPart {
  kind: 'text';  // Note: `kind`, not `type`
  value: string;
}
```

### Tool Confirmation

```typescript
// Note: Core's actual IToolConfirmationMessages has title + message (not array)
interface IToolConfirmationMessages {
  title?: string | IMarkdownString;
  message: string | IMarkdownString;  // MUST be set if title is set
  autoApprove?: boolean;
  isSecondChance?: boolean;
}
```

## Built-in Tools in VS Code Core

Located in `src/vs/workbench/contrib/chat/common/tools/` and `browser/tools/`:

| Tool | Purpose | Confirmation |
|---|---|---|
| `vscode_readFile` | Read file contents | No |
| `vscode_editFile` | Apply text edits | Yes (per edit) |
| `vscode_runInTerminal` | Execute shell commands | Yes (per command) |
| `vscode_searchFiles` | Search workspace files | No |
| `vscode_findSymbol` | Navigate to symbols | No |
| `vscode_getDiagnostics` | Get error/warning list | No |
| `vscode_getCodeActions` | Get quick fixes | No |

## Tool Registration

### In Core

```typescript
// In chat.contribution.ts
const toolRegistry = Registry.as<IToolRegistry>(ToolRegistryId);
toolRegistry.registerTool('quiz_search', QuizSearchToolDescriptor);
```

### Tool Descriptor

```typescript
class QuizSearchToolDescriptor implements IToolDescriptor {
  readonly name = 'quiz_search';
  readonly description = 'Search the codebase using quiz semantic search';
  readonly inputSchema: IJSONSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', default: 10 },
      filePattern: { type: 'string', description: 'Glob pattern for files' }
    },
    required: ['query']
  };

  async invoke(options: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { query, maxResults = 10, filePattern } = options.parameters as SearchInput;

    const results = await searchWorkspace(query, { maxResults, filePattern }, token);

    return {
      content: [{
        kind: 'text',
        value: results.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n')
      }]
    };
  }

  async prepareToolInvocation(context: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
    return {
      invocationMessage: `Searching workspace`,
      confirmationMessages: {
        title: 'Search workspace',
        message: `Search for "${context.parameters.query}"?`
      } satisfies IToolConfirmationMessages
    };
  }
}
```

## Copilot Chat Tool Patterns (Migration)

From `vscode-copilot-chat/src/extension/tools/`:

### Read File Pattern

```typescript
// From: extension/tools/node/readFile.ts
// Core target: common/tools/readFileTool.ts

interface ReadFileInput {
  file: string;           // Absolute file path
  startLine?: number;     // 1-based
  endLine?: number;
}

class ReadFileTool implements IChatTool {
  name = 'read_file';
  description = 'Read contents of a file. Prefer reading large sections over many calls.';

  async invoke({ parameters }: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { file, startLine, endLine } = parameters as ReadFileInput;
    const uri = URI.file(file);

    const content = await this.fileService.readFile(uri);
    const lines = content.value.toString().split('\n');

    const start = (startLine ?? 1) - 1;
    const end = endLine ?? lines.length;
    const selected = lines.slice(start, end).join('\n');

    return {
      content: [{ kind: 'text', value: selected }],
    };
  }
}
```

### Edit File Pattern

```typescript
// From: extension/tools/node/editFile.ts
// Core target: common/tools/editFileTool.ts

interface EditFileInput {
  file: string;
  oldString: string;      // Text to replace (must be unique enough)
  newString: string;      // Replacement text
}

class EditFileTool implements IChatTool {
  name = 'apply_edit';
  description = 'Apply a precise text edit to a file. The oldString must match exactly.';

  async invoke({ parameters }: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { file, oldString, newString } = parameters as EditFileInput;
    const uri = URI.file(file);

    const doc = await this.textModelService.createModelReference(uri);
    const text = doc.object.textEditorModel.getValue();

    if (!text.includes(oldString)) {
      return {
        content: [{ kind: 'text', value: `Error: oldString not found in ${file}` }],
        toolResultError: true
      };
    }

    const edit = new WorkspaceEdit();
    const range = findExactRange(text, oldString);
    edit.replace(uri, range, newString);
    await this.workspaceService.applyEdit(edit);

    return {
      content: [{ kind: 'text', value: `Successfully edited ${file}` }],
    };
  }

  async prepareToolInvocation({ parameters }: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
    return {
      invocationMessage: `Editing ${basename(parameters.file as string)}`,
      confirmationMessages: {
        title: `Edit ${basename(parameters.file as string)}`,
        message: `\`\`\`diff\n- ${parameters.oldString}\n+ ${parameters.newString}\n\`\`\``
      } satisfies IToolConfirmationMessages
    };
  }
}
```

### Run in Terminal Pattern

```typescript
// From: extension/tools/node/runInTerminal.ts
// Core target: common/tools/runInTerminalTool.ts

interface TerminalInput {
  command: string;
  cwd?: string;
  timeout?: number;
}

class RunInTerminalTool implements IChatTool {
  name = 'run_in_terminal';
  description = 'Run a shell command in the integrated terminal. Wait for output.';

  async invoke({ parameters }: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { command, cwd, timeout = 30000 } = parameters as TerminalInput;

    const terminal = await this.terminalService.createTerminal({ cwd });
    terminal.sendText(command);

    // Capture output
    const output = await waitForTerminalOutput(terminal, timeout, token);

    return {
      content: [{ kind: 'text', value: output }],
    };
  }

  async prepareToolInvocation({ parameters }: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
    return {
      invocationMessage: `Running terminal command`,
      confirmationMessages: {
        title: 'Run terminal command',
        message: `Run \`\`${parameters.command}\`\` in terminal?`
      } satisfies IToolConfirmationMessages
    };
  }
}
```

### Search Pattern

```typescript
// From: extension/tools/node/search.ts
// Core target: common/tools/searchTool.ts

interface SearchInput {
  query: string;
  maxResults?: number;
  includePattern?: string;
  excludePattern?: string;
}

class SearchTool implements IChatTool {
  name = 'search';
  description = 'Search for text patterns across workspace files using ripgrep.';

  async invoke({ parameters }: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { query, maxResults = 20, includePattern, excludePattern } = parameters as SearchInput;

    const results = await this.searchService.textSearch(
      { pattern: query, maxResults, includePattern, excludePattern },
      this.workspaceContextService.getWorkspace(),
      token
    );

    const formatted = results.results.map(r =>
      `${r.preview.text} (${r.file}:${r.preview.matches[0].startLineNumber})`
    ).join('\n');

    return {
      content: [{ kind: 'text', value: formatted }],
    };
  }
}
```

## Tool Confirmation UI

Tools can require user confirmation before execution:

```typescript
// In browser/tools/toolConfirmationUI.ts

class ToolConfirmationUI {
  async confirm(tool: IChatTool, parameters: Record<string, unknown>): Promise<boolean> {
    const prepared = await tool.prepareToolInvocation?.({ parameters, toolCallId: '' }, CancellationToken.None);
    if (!prepared?.confirmationMessages?.title) return true; // No confirmation needed

    const result = await this.dialogService.confirm({
      message: prepared.confirmationMessages.title as string,
      detail: typeof prepared.confirmationMessages.message === 'string' ? prepared.confirmationMessages.message : prepared.confirmationMessages.message.value,
      primaryButton: 'Allow',
      cancelButton: 'Cancel'
    });

    return result.confirmed;
  }
}
```

## Best Practices

1. **Always validate input** against JSON Schema before processing
2. **Use cancellation tokens** for long-running operations
3. **Return structured results** with clear error messages
4. **Provide confirmation dialogs** for destructive operations
5. **Keep descriptions concise** - LLM uses them to select tools
6. **Prefer text results** unless prompt-tsx parts are needed
7. **Handle file URIs properly** - use URI.parse(), not string concatenation
8. **Respect workspace trust** - check trust status before file operations
