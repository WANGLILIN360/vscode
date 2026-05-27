# Copilot Chat Extension Architecture

## Repository Layout

```
vscode-copilot-chat/
├── src/
│   ├── extension/           # Business logic (formerly copilot-specific)
│   │   ├── agents/          # Agent implementations
│   │   ├── api/vscode/      # Extension API exposure
│   │   ├── authentication/  # Auth handling
│   │   ├── byok/            # Bring-your-own-key
│   │   ├── chat/            # Chat request handling
│   │   ├── chatSessions/    # Session management
│   │   ├── completions/     # Inline completions
│   │   ├── conversation/    # Chat view/conversation UI logic
│   │   ├── context/         # Context gathering
│   │   ├── externalAgents/  # External agent integration
│   │   ├── inlineChat/      # Inline chat feature
│   │   ├── inlineEdits/     # Inline edit suggestions
│   │   ├── intents/         # Intent classification system
│   │   ├── prompts/         # Prompt engineering (TSX)
│   │   │   ├── common/
│   │   │   └── node/
│   │   │       ├── agent/       # Agent mode prompts
│   │   │       ├── inline/      # Inline chat prompts
│   │   │       ├── panel/       # Chat panel prompts
│   │   │       └── base/        # Shared prompt components
│   │   ├── tools/           # Tool implementations
│   │   │   ├── common/
│   │   │   ├── node/        # Node.js tools
│   │   │   └── vscode-node/ # VS Code API tools
│   │   └── ...
│   ├── platform/            # Abstraction layer
│   │   ├── authentication/  # GitHub auth
│   │   ├── chat/            # Chat platform types
│   │   ├── configuration/   # Settings management
│   │   ├── embeddings/      # Vector embeddings
│   │   ├── endpoint/        # LLM endpoint management
│   │   ├── filesystem/      # FS abstraction
│   │   ├── git/             # Git integration
│   │   ├── github/          # GitHub API
│   │   ├── telemetry/       # Telemetry collection
│   │   └── workspace/       # Workspace context
│   └── lib/                 # Shared libraries
├── chat-lib/                # @vscode/chat-lib package
├── build/                   # Build scripts
└── .esbuild.ts              # esbuild configuration
```

## Intent System (extension/intents/)

Intents classify user requests and route to appropriate handlers:

```typescript
enum Intent {
  Explain = 'explain',      // Code explanation
  Review = 'review',        // Code review
  Tests = 'tests',          // Test generation
  Fix = 'fix',              // Bug fixing
  New = 'new',              // New code generation
  Terminal = 'terminal',    // Terminal commands
  VSCode = 'vscode',        // VS Code help
  Workspace = 'workspace',  // Workspace operations
  Edit = 'edit',            // Code editing
  Agent = 'editAgent',      // Full agent mode
  AskAgent = 'askAgent',    // Conversational with tools
}
```

Flow: User request -> ChatParticipantRequestHandler -> Intent detection -> IntentService -> Handler -> Prompt building -> Execution

## Tool System (extension/tools/)

Tools are capabilities the agent can invoke:

**Core Tools:**
- `read_file` - Read file contents
- `edit_file` / `apply_edit` - Apply code edits
- `run_in_terminal` - Execute terminal commands
- `search` - Text/semantic search
- `find_symbol` - Symbol navigation
- `create_file` - File creation
- `delete_file` - File deletion
- `run_command` - VS Code command execution

**Tool Architecture:**
- Defined in `src/extension/tools/node/` and `src/extension/tools/vscode-node/`
- Schema-based input validation (JSON Schema)
- Confirmation dialog via `prepareInvocation()`
- Result streaming via `invoke()`
- Tool registration with `vscode.lm.registerTool()`

## Prompt Engineering (extension/prompts/)

Uses `@vscode/prompt-tsx` library for component-based prompts.

**Key Files:**
- `node/agent/agentPrompt.tsx` - Main agent prompt structure
- `node/agent/defaultAgentInstructions.tsx` - Base agent instructions
- `node/agent/promptRegistry.ts` - Model-specific prompt routing
- `node/agent/anthropicPrompts.tsx` - Claude-optimized prompts
- `node/agent/allAgentPrompts.ts` - Prompt exports

**Prompt Component Pattern:**
```tsx
class AgentPrompt extends PromptElement<AgentPromptProps> {
  render() {
    return (
      <>
        <SystemMessage>
          <CopilotIdentityRules />
          <SafetyRules />
          <AgentInstructions />
        </SystemMessage>
        <UserMessage>
          <WorkspaceStructure />
          <UserRequest />
        </UserMessage>
        <ConversationHistory />
      </>
    );
  }
}
```

**Prompt Registry Pattern:**
```typescript
class MyProviderPromptResolver implements IAgentPrompt {
  static readonly familyPrefixes = ['my-model'];
  resolvePrompt(endpoint: IChatEndpoint): PromptConstructor | undefined {
    if (endpoint.model?.startsWith('my-model-1')) {
      return MyModel1Prompt;
    }
    return MyDefaultPrompt;
  }
}
```

## Authentication (platform/authentication/)

- GitHub OAuth flow via VS Code Authentication API
- Multiple provider support (GitHub.com, GHE.com, Google, Apple)
- Token refresh and management
- Entitlement checking via GitHub API

## Endpoint Management (platform/endpoint/)

- LLM endpoint abstraction
- Request/response formatting per provider
- Rate limiting and retry logic
- Streaming response handling

## Conversation Management (extension/conversation/)

- Chat view state management
- Message history
- Session persistence
- Context window management with summarization

## Build System

- **Entry**: `.esbuild.ts` (esbuild configuration)
- **Extension host**: Supports both Node.js and Web Worker
- **Node entry**: `extension/extension/vscode-node/extension.ts`
- **Web entry**: `extension/extension/vscode-worker/extension.ts`
- **Output**: `dist/extension.js` (desktop), `dist/web.js` (web)
