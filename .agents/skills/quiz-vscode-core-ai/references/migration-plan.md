# Migration Plan: Copilot Chat -> VS Code Core quiz Contribution

## Architecture Decision

quiz is a **VS Code Core contribution** at `src/vs/workbench/contrib/quiz/`.

**NOT** an extension at `extensions/quiz/`.

This follows the same pattern as `contrib/git/`, `contrib/terminal/`, `contrib/search/` -- core contributions that ship with VS Code.

## Source and Target

| From | To |
|---|---|
| `extensions/copilot/src/extension/` | `src/vs/workbench/contrib/quiz/` |
| `extensions/copilot/src/platform/` | `src/vs/workbench/contrib/quiz/` + reuse `contrib/chat/` |
| `extensions/copilot/src/lib/` | `src/vs/workbench/contrib/quiz/common/` |

## Component Mapping

### 1. Chat UI (Browser Layer)

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/conversation/chatViewPane` | `quiz/browser/quizAgentView.ts` | Create quiz view pane |
| Inline chat features | `quiz/browser/quizInlineWidget.ts` | Extend inline chat |
| Chat widget rendering | `quiz/browser/quizWidget.ts` | Extend ChatWidget |
| Input with attachments | `quiz/browser/quizInputPart.ts` | Extend ChatInputPart |
| Chat editing UI | `quiz/browser/quizEditingWidget.ts` | Port editing UX |
| Session management | `quiz/browser/quizSessions.ts` | Port session UI |

All UI registration happens in `quiz/browser/quiz.contribution.ts`.

### 2. Language Model Integration

| Copilot Component | quiz Target | Action |
|---|---|---|
| `platform/endpoint/` | `quiz/common/quizLanguageModel.ts` | Port endpoint logic |
| `platform/embeddings/` | `quiz/common/embeddings/` | Port embedding service |
| Model selection UI | `quiz/browser/quizWidget.ts` | Add model picker |

### 3. Tool System

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/tools/node/*.ts` | `quiz/common/tools/*.ts` | Port each tool |
| Tool confirmation UI | `quiz/browser/toolConfirmation.ts` | Port confirmation UX |
| `read_file` | `quiz/common/tools/readFileTool.ts` | Port |
| `edit_file` | `quiz/common/tools/editFileTool.ts` | Port |
| `run_in_terminal` | `quiz/common/tools/terminalTool.ts` | Port |
| `search` | `quiz/common/tools/searchTool.ts` | Port |

Tools register in `quiz/browser/quiz.contribution.ts` via `ILanguageModelToolsService`.

### 4. Prompt Engineering

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/prompts/node/agent/*.tsx` | `quiz/common/prompts/*.tsx` | Port all TSX prompts |
| `extension/prompts/node/agent/promptRegistry.ts` | `quiz/common/prompts/registry/promptRegistry.ts` | Port registry |
| Model-specific prompts | `quiz/common/prompts/registry/*.tsx` | Port per-model variants |
| Base prompt components | `quiz/common/prompts/base/*.tsx` | Port shared components |

### 5. Intent System

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/intents/*.ts` | `quiz/common/intents/*.ts` | Port classification |

### 6. Context Gathering

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/context/*.ts` | `quiz/common/context/*.ts` | Port providers |
| `extension/chatSessionContext/` | `quiz/common/context/sessionContext.ts` | Port |

### 7. Authentication

| Copilot Component | quiz Target | Action |
|---|---|---|
| `platform/authentication/` | `quiz/common/auth/` | Port auth logic |

### 8. Session Management

| Copilot Component | quiz Target | Action |
|---|---|---|
| `extension/conversation/*.ts` | `quiz/common/quizSessions.ts` | Port |
| `extension/chatSessions/*.ts` | `quiz/common/model/quizSessionModel.ts` | Port |

## Migration Phases

### Phase 1: Foundation (Weeks 1-4)

Create `contrib/quiz/` directory structure:

```
src/vs/workbench/contrib/quiz/
├── browser/quiz.contribution.ts
├── browser/quizAgentView.ts
├── common/quizService.ts
├── common/quizServiceImpl.ts
├── common/constants.ts
└── test/
```

Steps:
1. `browser/quiz.contribution.ts` - Register quiz view, commands, services
2. `common/quizService.ts` - Define IQuizService interface
3. `common/quizServiceImpl.ts` - Implement service
4. `browser/quizAgentView.ts` - Create view pane
5. `workbench.common.main.ts` - Import quiz contribution

### Phase 2: Prompts (Weeks 5-8)

```
common/prompts/
├── quizAgentPrompt.tsx
├── quizPanelPrompt.tsx
├── base/
│   ├── identity.tsx
│   ├── toolInstructions.tsx
│   └── workspaceContext.tsx
└── registry/
    ├── promptRegistry.ts
    ├── anthropicPrompts.tsx
    ├── openaiPrompts.tsx
    └── geminiPrompts.tsx
```

### Phase 3: Tools (Weeks 9-12)

```
common/tools/
├── quizToolsService.ts
├── readFileTool.ts
├── editFileTool.ts
├── terminalTool.ts
├── searchTool.ts
├── findSymbolTool.ts
├── createFileTool.ts
└── deleteFileTool.ts
```

### Phase 4: Context + Intents (Weeks 13-16)

```
common/context/
├── workspaceContext.ts
├── editorContext.ts
└── quizContextProvider.ts

common/intents/
├── intentService.ts
├── intentHandlers.ts
└── intentTypes.ts
```

### Phase 5: UI Polish (Weeks 17-20)

```
browser/
├── media/quiz.css
├── quizWidget.ts
├── quizInputPart.ts
├── quizEditingWidget.ts
├── quizStatusBar.ts
└── actions/quizActions.ts
```

### Phase 6: Integration (Weeks 21-24)

End-to-end testing, performance optimization, documentation.

## Import Pattern

quiz code imports from chat infrastructure using internal APIs:

```typescript
// From chat infrastructure (reused)
import { IChatService } from 'vs/workbench/contrib/chat/common/chatService/chatService';
import { IChatAgentService } from 'vs/workbench/contrib/chat/common/participants/chatAgents';
import { ILanguageModelToolsService } from 'vs/workbench/contrib/chat/common/tools/languageModelToolsService';
import { ChatAgentLocation } from 'vs/workbench/contrib/chat/common/constants';
import { renderPrompt } from 'vs/workbench/contrib/chat/common/prompts/promptTsx';

// Platform services
import { ILanguageModelsService } from 'vs/platform/languageModel/common/languageModels';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// Internal to quiz
import { IQuizService } from 'vs/workbench/contrib/quiz/common/quizService';
```

## What quiz Does NOT Use

quiz does not use:
- `extensions/quiz/` directory
- `vscode.*` extension API
- Extension manifest (`package.json` `contributes`)
- `activate()` / `deactivate()`
- Separate build process
