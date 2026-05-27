# Chat UI Reference for quiz

## Chat Surfaces in VS Code Core

VS Code Core provides 4 chat surfaces, all located in `src/vs/workbench/contrib/chat/browser/`:

### 1. Chat Panel (Primary)

**Files:**
- `chatViewPane.ts` - ViewPane container
- `chatWidget.ts` - Main widget
- `chatInputPart.ts` - Input area with attachments
- `chatSessions/` - Session tabs/management

**Architecture:**
```
ChatViewPane (extends ViewPane)
└── ChatWidget
    ├── ChatHeader (title, model picker, mode selector)
    ├── ChatListWidget (message list)
    │   ├── ChatRequestRenderer (user messages)
    │   ├── ChatResponseRenderer (AI responses)
    │   ├── CodeBlockRenderer (fenced code)
    │   ├── ToolInvocationRenderer (tool calls)
    │   └── ChatEditingRenderer (file edits)
    └── ChatInputPart
        ├── InputEditor (monaco editor)
        ├── AttachmentBar (files, symbols)
        ├── SubmitButton
        └── FollowupButtons
```

**Key Classes:**
- `ChatWidget` - Main component, manages list + input
- `ChatListWidget` - Virtualized list of chat items
- `ChatInputPart` - Input with rich editing
- `ChatViewPane` - Container in sidebar

### 2. Inline Chat

**Files (separate contribution):**
- `src/vs/workbench/contrib/inlineChat/browser/inlineChatWidget.ts`
- `src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts`
- `src/vs/workbench/contrib/inlineChat/browser/inlineChatSession.ts`

**Architecture:**
```
InlineChatController
└── InlineChatWidget (zones widget in editor)
    ├── Header (title + close)
    ├── Content (response streaming)
    ├── Input (compact input)
    └── Actions (accept/discard)
```

**Key Classes:**
- `InlineChatController` - Lifecycle management
- `InlineChatWidget` - Zone widget in editor
- `InlineChatSession` - Session for inline chat

### 3. Quick Chat

**Files:**
- `src/vs/workbench/contrib/chat/browser/chatWidget.ts` (shared widget)
- `src/vs/workbench/contrib/chat/browser/actions/chatQuickActions.ts`

**Architecture:** Quick chat is a floating ChatWidget instance that appears at the top of the editor area. It uses the same ChatWidget class with a compact configuration.

**Key Points:**
- Uses `ChatWidget` with `isQuickChat = true`
- Appears via keybinding (Shift+Alt+Cmd+L)
- Can "Open in Chat View" to transfer to panel
- No session persistence

### 4. Editor Chat

**Files:**
- `src/vs/workbench/contrib/chat/browser/chatWidget.ts`
- `src/vs/workbench/contrib/chat/browser/actions/chatEditorActions.ts`

Chat can be opened as an editor tab, allowing multiple concurrent chat sessions.

## Key UI Components

### ChatWidget (`browser/chatWidget.ts`)

Central component. Key members:

```typescript
class ChatWidget extends Disposable {
  readonly inputEditor: ICodeEditor;           // Monaco input
  readonly tree: WorkbenchObjectTree<...>;     // Message list
  readonly inputPart: ChatInputPart;           // Input area

  // State
  readonly viewModel: IChatViewModel | undefined;
  readonly chatService: IChatService;

  // Methods
  acceptInput(): Promise<void>;                // Send message
  focusInput(): void;                          // Focus input
  getViewState(): IChatViewState;              // Serialize
  restoreViewState(state: IChatViewState): void;
}
```

### ChatInputPart (`browser/chatInputPart.ts`)

Input area with attachments:

```typescript
class ChatInputPart extends Disposable {
  readonly editor: ICodeEditor;
  readonly attachments: ChatAttachmentModel;

  // UI elements
  render(container: HTMLElement): void;
  getValue(): string;
  setValue(value: string): void;
  addFileAttachment(uri: URI): void;
  addSymbolAttachment(symbol: IWorkspaceSymbol): void;
}
```

### Chat Editing UI (`browser/chatEditing/`)

File editing visualization with Keep/Undo:

```typescript
// browser/chatEditing/chatEditingSession.ts
interface IChatEditingSession {
  readonly entries: IObservable<readonly IModifiedFileEntry[]>;
  accept(entry: IModifiedFileEntry): Promise<void>;
  reject(entry: IModifiedFileEntry): Promise<void>;
  acceptAll(): Promise<void>;
  rejectAll(): Promise<void>;
}

// browser/chatEditing/chatEditingWidget.ts
class ChatEditingWidget {
  renderChanges(entries: IModifiedFileEntry[]): void;
}
```

### Mode Selector (`browser/chatSessions/`)

Chat mode UI (Ask, Edit, Agent):

```typescript
// common/constants.ts
enum ChatModeKind {
  Ask = 1,      // Conversational only
  Edit = 2,     // Code editing with diffs
  Agent = 3,    // Autonomous with tools
}
```

Mode selector rendered in chat header.

## Branding Integration Points

For quiz branding, customize these locations:

### CSS/Styling

```css
/* browser/media/quiz.css */
.chat-widget.quiz .header {
  --chat-header-bg: var(--quiz-brand-color);
}

.chat-widget.quiz .input-part {
  border-top: 1px solid var(--quiz-border-color);
}
```

### Icons

```typescript
// Use product icon references
const quizIcon = Codicon.quiz;  // Register in icon registry

// Or use file icons
const quizLogo = FileAccess.asFileUri('vs/workbench/contrib/chat/browser/media/quiz.svg');
```

### Strings

All user-facing strings must use `localize()`:

```typescript
const title = localize('quiz.chatTitle', 'quiz Chat');
const placeholder = localize('quiz.inputPlaceholder', 'Ask quiz...');
```

## Actions and Keybindings

Register in `browser/actions/`:

```typescript
// browser/actions/quizActions.ts
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: 'quiz.openChat',
      title: localize('openChat', 'Open quiz Chat'),
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

## View Registration

```typescript
// In chat.contribution.ts
const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainersExtensions.ViewContainersRegistry)
  .registerViewContainer({
    id: 'quiz.chat',
    title: localize('quizChat', 'quiz'),
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['quiz.chat', { mergeViewWithContainerWhenSingleView: true }]),
    storageId: 'quiz.chat',
    hideIfEmpty: true,
    order: 1
  }, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry)
  .registerViews([{
    id: 'quiz.chatPanel',
    name: localize('chatPanel', 'Chat'),
    containerIcon: Codicon.commentDiscussion,
    canToggleVisibility: false,
    ctorDescriptor: new SyncDescriptor(ChatViewPane),
  }], viewContainer);
```

## Rendering Chat Messages

### Response Streaming

```typescript
// In chat request handler
const handler: ChatRequestHandler = async (request, context, response, token) => {
  // Stream markdown
  response.markdown('Processing...');

  // Stream code blocks
  response.markdown('```typescript\n');
  for await (const chunk of llmResponse) {
    response.markdown(chunk);
  }
  response.markdown('\n```');

  // Add file reference
  response.reference(URI.file('/path/to/file.ts'));

  // Report progress
  response.progress('Searching codebase...');
};
```

### Tool Invocation Rendering

```typescript
// Tools render as expandable sections
response.toolInvocation('quiz_search', { query: 'foo' }, async (token) => {
  const results = await search('foo', token);
  return { content: [{ kind: 'text', value: results }] };
});
```
