# @vscode/prompt-tsx API Reference

## Core Concepts

Prompts are TSX component trees that render to ChatMessage arrays. Each node has a `priority` (like zIndex) for context window management.

## Key Types

### PromptElement

Base class for all prompt components:

```typescript
abstract class PromptElement<P extends BasePromptElementProps, S> {
  readonly props: P;
  readonly priority?: number;
  abstract render(): PromptPiece | PromptPiece[];
}
```

### ChatMessage Types

```typescript
SystemMessage   // System instructions
UserMessage     // User input
AssistantMessage // AI response
TextChunk       // Fragment with independent priority
```

### Rendering

```typescript
function renderPrompt<T extends BasePromptElementProps>(
  PromptElementCtor: new (props: T) => PromptElement<T, any>,
  props: T,
  opts: { modelMaxPromptTokens: number },
  model: ILanguageModel
): Promise<{ messages: ChatMessage[]; tokenCount: number }>;
```

## Priority System

Higher priority = kept longer when context window is exceeded. Default priority is 0.

```tsx
<SystemMessage priority={100}>  {/* Always kept */}
  Critical instructions
</SystemMessage>
<UserMessage priority={50}>     {/* Kept after system */}
  <TextChunk priority={10}>Recent context</TextChunk>
  <TextChunk priority={1}>Old context</TextChunk>  {/* Dropped first */}
</UserMessage>
```

## VS Code Core Import Path

In VS Code Core, import from the internal prompt-tsx module:

```typescript
// Core path (not npm package)
import { PromptElement, SystemMessage, UserMessage, renderPrompt } from 'vs/workbench/contrib/chat/common/prompts/promptTsx';
```

In extensions, use:

```typescript
import { PromptElement, SystemMessage, UserMessage, renderPrompt } from '@vscode/prompt-tsx';
```

## Common Prompt Components

### Identity/Branding

```tsx
class QuizIdentity extends PromptElement {
  render() {
    return (
      <TextChunk priority={100}>
        You are quiz, an AI coding assistant built into the editor.
        You help users write, understand, and improve code.
      </TextChunk>
    );
  }
}
```

### Tool Instructions

```tsx
class ToolInstructions extends PromptElement<{ tools: ITool[] }> {
  render() {
    return (
      <TextChunk priority={90}>
        Available tools:
        {this.props.tools.map(t => (
          <TextChunk>- {t.name}: {t.description}</TextChunk>
        ))}
        Use tools by calling them with JSON parameters.
        Wait for tool results before proceeding.
      </TextChunk>
    );
  }
}
```

### Conversation History

```tsx
class ConversationHistory extends PromptElement<{ history: IChatMessage[] }> {
  render() {
    return this.props.history.map((msg, i) => (
      <TextChunk key={i} priority={msg.role === 'user' ? 40 : 30}>
        {msg.role === 'user' ? <UserMessage>{msg.content}</UserMessage> : <AssistantMessage>{msg.content}</AssistantMessage>}
      </TextChunk>
    ));
  }
}
```

### Workspace Context

```tsx
class WorkspaceContext extends PromptElement<{ workspace: IWorkspace }> {
  render() {
    return (
      <TextChunk priority={20}>
        Workspace: {this.props.workspace.name}
        Open files: {this.props.workspace.openFiles.join(', ')}
        Language: {this.props.workspace.language}
      </TextChunk>
    );
  }
}
```

## Prompt Registry Pattern

Model-specific prompt routing:

```typescript
interface IQuizPromptResolver {
  readonly familyPrefixes: string[];
  resolvePrompt(endpoint: IChatEndpoint): PromptConstructor | undefined;
}

class AnthropicPromptResolver implements IQuizPromptResolver {
  static readonly familyPrefixes = ['claude', 'anthropic'];

  resolvePrompt(endpoint: IChatEndpoint): PromptConstructor | undefined {
    if (endpoint.model?.includes('claude-4')) {
      return Claude4QuizPrompt;
    }
    return DefaultQuizPrompt;
  }
}

// Registry
const promptResolvers: IQuizPromptResolver[] = [
  new AnthropicPromptResolver(),
  new OpenAIPromptResolver(),
  new GeminiPromptResolver(),
];

function resolvePromptForEndpoint(endpoint: IChatEndpoint): PromptConstructor {
  for (const resolver of promptResolvers) {
    const prefixMatch = resolver.familyPrefixes.some(p => endpoint.modelFamily?.startsWith(p));
    if (prefixMatch) {
      const prompt = resolver.resolvePrompt(endpoint);
      if (prompt) return prompt;
    }
  }
  return DefaultQuizPrompt;
}
```

## Agent Prompt Structure

Standard agent prompt layout from Copilot Chat:

```tsx
class QuizAgentPrompt extends PromptElement<AgentPromptProps> {
  render() {
    return (
      <>
        {/* Highest priority: identity and safety */}
        <SystemMessage priority={100}>
          <QuizIdentityRules />
          <SafetyRules />
          <AgentModeInstructions mode={this.props.mode} />
        </SystemMessage>

        {/* High priority: tool definitions */}
        <SystemMessage priority={90}>
          <ToolInstructions tools={this.props.tools} />
          <ToolUsageRules />
        </SystemMessage>

        {/* Medium priority: user preferences */}
        <UserMessage priority={50}>
          <UserPreferences prefs={this.props.preferences} />
          <GlobalContext workspace={this.props.workspace} />
        </UserMessage>

        {/* Dynamic priority: conversation */}
        <ConversationHistory history={this.props.history} />

        {/* Current request */}
        <UserMessage priority={60}>
          <AttachedContext context={this.props.attachedContext} />
          <UserRequest query={this.props.query} />
          <ReminderInstructions />
        </UserMessage>

        {/* Tool calls from previous turns */}
        {this.props.pendingToolCalls.map(tc => (
          <ToolCallElement key={tc.id} toolCall={tc} />
        ))}
      </>
    );
  }
}
```

## Summarization Pattern

For long conversations, use background summarization:

```typescript
class SummarizedHistory extends PromptElement<{ history: IChatMessage[] }> {
  render() {
    // If history is short, render directly
    if (this.props.history.length < 10) {
      return <ConversationHistory history={this.props.history} />;
    }

    // Otherwise, render summary + recent messages
    const recent = this.props.history.slice(-6);
    const older = this.props.history.slice(0, -6);

    return (
      <>
        <SystemMessage priority={45}>
          <TextChunk>Previous conversation summary:</TextChunk>
          <ConversationSummary messages={older} />
        </SystemMessage>
        <ConversationHistory history={recent} />
      </>
    );
  }
}
```
