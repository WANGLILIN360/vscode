# VS Code Core Chat Architecture

## Directory Structure

```
src/vs/workbench/contrib/chat/
├── browser/                          # UI layer
│   ├── accessibility/               # A11y support for chat
│   ├── actions/                     # Chat actions (toolbar, context menu)
│   ├── agentPluginEditor/           # Plugin/agent editor UI
│   ├── agentSessions/               # Agent session management UI
│   ├── aiCustomization/             # AI customization UI
│   ├── attachments/                 # File/variable attachment UI
│   ├── chatDebug/                   # Chat debugging panel
│   ├── chatEditing/                 # Inline editing UI (Keep/Undo)
│   ├── chatManagement/              # Chat view management
│   ├── chatSessions/                # Session list UI
│   ├── chatSetup/                   # Onboarding/setup UI
│   ├── chatStatus/                  # Status bar integration
│   ├── contextContrib/              # Context contribution UI
│   ├── planReviewFeedback/          # Plan review UI
│   ├── promptSyntax/                # Prompt syntax highlighting
│   ├── telemetry/                   # Telemetry collection
│   ├── tools/                       # Built-in tool UI
│   ├── viewsWelcome/                # Welcome page for chat
│   ├── widget/                      # Core chat widget
│   ├── widgetHosts/                 # Widget host containers
│   ├── chat.contribution.ts         # Module registration
│   └── chat.ts                      # Main chat service interface
├── common/                           # Business logic
│   ├── actions/                     # Action definitions
│   ├── attachments/                 # Attachment models
│   ├── chatService/                 # Chat service implementation
│   ├── contextContrib/              # Context providers
│   ├── editing/                     # Chat editing logic
│   ├── model/                       # Chat data models
│   ├── participants/                # Chat participant registry
│   ├── plugins/                     # Chat plugins system
│   ├── promptSyntax/                # Prompt parsing
│   ├── requestParser/               # Request parsing
│   ├── tools/                       # Tool definitions
│   ├── widget/                      # Widget state models
│   ├── chat.ts                      # Core chat interfaces
│   ├── languageModels.ts            # Language model registry
│   ├── languageModelsConfiguration.ts  # LM configuration
│   ├── constants.ts                 # Chat constants/modes
│   └── chatModes.ts                 # Chat mode definitions
└── electron-browser/                 # Electron-specific
```

## Key Interfaces (common/chat.ts)

- `IChatService` - Main chat service for sending/receiving messages
- `IChatWidgetService` - Widget lifecycle management
- `IChatAgentService` - Agent/participant registry
- Chat modes: `ask`, `edit`, `agent` (ChatModeKind enum)

## Language Model System (common/languageModels.ts)

- `ILanguageModelChatMetadata` - Model metadata (id, name, vendor, capabilities)
- `ILanguageModelsService` - Model discovery and selection
- `COPILOT_VENDOR_ID = 'copilot'` - Built-in vendor constant
- Supports toolCalling, vision, maxInputTokens, maxOutputTokens
- Model groups/providers: copilot, azure, anthropic, openai, gemini, etc.

## Chat Service (common/chatService/)

- `IChatService` - Core service interface
- Request/response lifecycle
- Session management
- Tool invocation orchestration
- Streaming response handling

## Data Models (common/model/)

- `IChatModel` - Chat session model
- `IChatRequestModel` - User request
- `IChatResponseModel` - AI response
- `IChatProgress` - Streaming progress parts
- Conversation history management

## Participant System (common/participants/)

- `IChatAgentData` - Agent metadata
- `IChatAgentImplementation` - Agent handler
- Registration via `vscode.chat.createChatParticipant()`
- Slash commands and sub-commands

## Built-in Tools (common/tools/)

- `IChatTool` - Tool interface
- `IChatToolInvocation` - Invocation state
- Tool confirmation/approval flow
- Tool result handling

## UI Widget (browser/widget/)

- `ChatWidget` - Main chat widget
- `ChatInputPart` - Input area with attachments
- `ChatListWidget` - Message list renderer
- `ChatViewPane` - View panel container
- Supports: inline chat, quick chat, panel chat, editor chat
