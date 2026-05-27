# Code Map: Key Files and Migration Targets

## VS Code Core Chat Files (Reference)

### Registration & Contribution
- `src/vs/workbench/contrib/chat/browser/chat.contribution.ts` - Main module registration
- `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` - Shared registration
- `src/vs/workbench/contrib/chat/browser/chat.view.contribution.ts` - View contribution

### Core Services
- `src/vs/workbench/contrib/chat/common/chatService/chatService.ts` - Chat service
- `src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts` - Implementation
- `src/vs/workbench/contrib/chat/common/languageModels.ts` - LM registry (2223 lines)
- `src/vs/workbench/contrib/chat/common/languageModelsConfiguration.ts` - LM config
- `src/vs/workbench/contrib/chat/common/chatSessionsService.ts` - Session service

### Data Models
- `src/vs/workbench/contrib/chat/common/model/chatModel.ts` - Chat session model
- `src/vs/workbench/contrib/chat/common/model/chatRequestModel.ts` - Request model
- `src/vs/workbench/contrib/chat/common/model/chatResponseModel.ts` - Response model
- `src/vs/workbench/contrib/chat/common/constants.ts` - ChatModeKind, ChatAgentLocation

### UI Widget
- `src/vs/workbench/contrib/chat/browser/chatWidget.ts` - Main widget
- `src/vs/workbench/contrib/chat/browser/chatViewPane.ts` - View pane
- `src/vs/workbench/contrib/chat/browser/chat.ts` - Widget service
- `src/vs/workbench/contrib/chat/browser/chatInputPart.ts` - Input area
- `src/vs/workbench/contrib/chat/browser/chatHeader.ts` - Chat header

### Inline Chat
- `src/vs/workbench/contrib/inlineChat/` - Separate contribution
- `src/vs/workbench/contrib/inlineChat/browser/inlineChatWidget.ts`
- `src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts`

### Tools
- `src/vs/workbench/contrib/chat/common/tools/` - Tool definitions
- `src/vs/workbench/contrib/chat/browser/tools/` - Tool UI

### Participants/Agents
- `src/vs/workbench/contrib/chat/common/participants/chatAgents.ts`
- `src/vs/workbench/contrib/chat/common/participants/chatParticipantContribTypes.ts`

### Editing
- `src/vs/workbench/contrib/chat/browser/chatEditing/` - Editing UI
- `src/vs/workbench/contrib/chat/common/editing/` - Editing logic

### Prompt System
- `src/vs/workbench/contrib/chat/common/promptSyntax/` - Prompt parsing

## Copilot Chat Extension Files (Migrate From)

### Extension Entry Points
- `src/extension/extension/vscode-node/extension.ts` - Node extension entry
- `src/extension/extension/vscode-worker/extension.ts` - Web worker entry

### Prompts (Critical Migration)
- `src/extension/prompts/node/agent/agentPrompt.tsx` - Main agent prompt
- `src/extension/prompts/node/agent/defaultAgentInstructions.tsx` - Base instructions
- `src/extension/prompts/node/agent/promptRegistry.ts` - Prompt routing
- `src/extension/prompts/node/agent/allAgentPrompts.ts` - Prompt exports
- `src/extension/prompts/node/agent/anthropicPrompts.tsx` - Claude prompts
- `src/extension/prompts/node/agent/openai/` - OpenAI-specific prompts
- `src/extension/prompts/node/panel/` - Panel chat prompts
- `src/extension/prompts/node/inline/` - Inline chat prompts
- `src/extension/prompts/node/base/` - Shared prompt components

### Tools (Critical Migration)
- `src/extension/tools/node/readFile.ts` - Read file tool
- `src/extension/tools/node/editFile.ts` - Edit file tool
- `src/extension/tools/node/runInTerminal.ts` - Terminal tool
- `src/extension/tools/node/search.ts` - Search tool
- `src/extension/tools/node/findSymbol.ts` - Symbol navigation
- `src/extension/tools/vscode-node/` - VS Code API-based tools
- `src/extension/tools/common/` - Tool interfaces

### Intents
- `src/extension/intents/` - Intent classification
- `src/extension/intents/intentHandler.ts` - Handler interface
- `src/extension/intents/intentService.ts` - Classification service

### Context
- `src/extension/context/` - Context gathering
- `src/extension/chatSessionContext/` - Session context
- `src/extension/contextKeys/` - Context key contributions

### Conversation
- `src/extension/conversation/` - Chat conversation logic
- `src/extension/conversation/chatParticipants.ts` - Participant registration
- `src/extension/conversationStore/` - Persistence

### Session
- `src/extension/chatSessions/` - Session management
- `src/extension/chat/chatSession.ts` - Session implementation

### Auth & Platform
- `src/platform/authentication/` - Auth abstraction
- `src/platform/endpoint/` - LLM endpoints
- `src/platform/telemetry/` - Telemetry
- `src/platform/workspace/` - Workspace info

### Configuration
- `src/extension/configuration/` - quiz-specific settings
- `src/platform/configuration/` - Platform config

## New quiz Files (Create in contrib/quiz/)

quiz is a Core contribution at `src/vs/workbench/contrib/quiz/` -- not an extension.

### Browser Layer
- `src/vs/workbench/contrib/quiz/browser/quiz.contribution.ts` - Registration
- `src/vs/workbench/contrib/quiz/browser/quizAgentView.ts` - View pane
- `src/vs/workbench/contrib/quiz/browser/quizWidget.ts` - Chat widget
- `src/vs/workbench/contrib/quiz/browser/quizInputPart.ts` - Input area
- `src/vs/workbench/contrib/quiz/browser/quizEditingWidget.ts` - Editing UI
- `src/vs/workbench/contrib/quiz/browser/quizStatusBar.ts` - Status bar
- `src/vs/workbench/contrib/quiz/browser/media/quiz.css` - Styles
- `src/vs/workbench/contrib/quiz/browser/actions/quizActions.ts` - Actions

### Common Layer
- `src/vs/workbench/contrib/quiz/common/quizService.ts` - Service interface
- `src/vs/workbench/contrib/quiz/common/quizServiceImpl.ts` - Implementation
- `src/vs/workbench/contrib/quiz/common/quizAgent.ts` - Agent registration
- `src/vs/workbench/contrib/quiz/common/quizLanguageModel.ts` - LLM provider
- `src/vs/workbench/contrib/quiz/common/constants.ts` - Constants
- `src/vs/workbench/contrib/quiz/common/model/` - Data models
- `src/vs/workbench/contrib/quiz/common/prompts/` - TSX prompts
- `src/vs/workbench/contrib/quiz/common/tools/` - Tool implementations
- `src/vs/workbench/contrib/quiz/common/intents/` - Intent system
- `src/vs/workbench/contrib/quiz/common/context/` - Context providers

### NOT Created
- ~~`extensions/quiz/`~~ - quiz is NOT an extension

## Build Files

### VS Code Core Build
- `gulpfile.js` - Root gulpfile
- `build/gulpfile.js` - Core build
- `build/gulpfile.vscode.js` - VS Code product build
- `build/lib/bundle.js` - Bundling
- `package.json` - Scripts: `npm run compile`, `npm run gulp`

### Copilot Chat Build
- `.esbuild.ts` - esbuild config
- `package.json` - Extension manifest with `contributes`
- `build/` - Build scripts

## Key Lines of Code (Scale Reference)

| Component | Approximate LOC |
|---|---|
| `common/languageModels.ts` | 2,200 |
| `browser/chatWidget.ts` | 1,500 |
| `extension/prompts/` | 8,000+ |
| `extension/tools/` | 5,000+ |
| `platform/endpoint/` | 3,000+ |
| `extension/conversation/` | 4,000+ |
| **Total Copilot Chat src/** | **~150,000** |
| **Total VS Code Core contrib/chat/** | **~80,000** |
