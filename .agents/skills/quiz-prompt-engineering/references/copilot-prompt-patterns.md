# Copilot Chat Prompt Patterns (Migration Reference)

These patterns are extracted from the Copilot Chat extension and should be adapted for quiz.

## File: defaultAgentInstructions.tsx

### Agent Identity

```tsx
<Tag name="instructions">
  You are a highly sophisticated automated coding agent with expert-level
  knowledge across many programming languages and frameworks. The user will
  ask a question or ask you to perform a task, which may require research.
  There is a selection of tools that let you perform actions or retrieve context.
</Tag>
```

### Tool Usage Rules

Key rules from Copilot Chat prompts:

1. **ReadFile**: Prefer reading large sections over many sequential calls. Read in parallel when possible.
2. **FindTextInFiles**: Use for overview instead of multiple ReadFile calls.
3. **RunInTerminal**: Don't call multiple times in parallel. Run one command, wait for output.
4. **EditFile**: Use ReplaceString only when string is unique. Use structured edits otherwise.
5. **Terminal edits**: NEVER edit files via terminal commands unless user specifically asks.
6. **Preferences**: Use UpdateUserPreferences to save user corrections and preferences.

### CodeMapper Instructions

```tsx
<Tag name="codeMapperInstructions">
  When applying edits:
  - Ensure edits are minimal and precise
  - Preserve surrounding code formatting
  - Add imports when introducing new dependencies
  - Follow existing code style in the file
  - Verify edits don't introduce syntax errors
</Tag>
```

## File: agentPrompt.tsx

### Prompt Structure

The agent prompt uses a nested hierarchy:

```
AgentPrompt
├── SystemMessage (priority 100)
│   ├── CopilotIdentity
│   ├── SafetyRules
│   ├── AgentInstructions
│   └── ToolDescriptions
├── UserMessage (priority 80)
│   ├── WorkspaceSnapshot
│   ├── OpenEditors
│   └── Diagnostics
├── ConversationHistory (priority 50)
│   └── [Message pairs...]
└── UserMessage (priority 60)
    ├── AttachedFiles
    ├── UserQuery
    └── FollowUpReminders
```

### Key Props Interface

```typescript
interface AgentPromptProps extends BasePromptElementProps {
  request: IChatRequest;
  context: IChatContext;
  tools: IChatTool[];
  history: IChatMessage[];
  workspace: IWorkspaceSnapshot;
  preferences: IUserPreferences;
  mode: 'ask' | 'edit' | 'agent';
}
```

## File: promptRegistry.ts

### Registry Implementation

```typescript
interface IAgentPrompt {
  readonly familyPrefixes: readonly string[];
  resolvePrompt(endpoint: IChatEndpoint): PromptConstructor | undefined;
}

type PromptConstructor = new (props: AgentPromptProps) => PromptElement<AgentPromptProps>;

const registry = new Map<string, PromptConstructor>();

export function registerPrompt(familyPrefix: string, ctor: PromptConstructor): void {
  registry.set(familyPrefix, ctor);
}

export function resolvePrompt(endpoint: IChatEndpoint): PromptConstructor {
  for (const [prefix, ctor] of registry) {
    if (endpoint.modelFamily?.startsWith(prefix)) {
      return ctor;
    }
  }
  return DefaultAgentPrompt;
}
```

## File: anthropicPrompts.tsx

### Claude-Specific Instructions

Claude models need specific prompting for tool use:

```tsx
class ClaudeAgentPrompt extends AgentPrompt {
  render() {
    return (
      <>
        <SystemMessage priority={100}>
          <AnthropicIdentity />
          <ToolUseFormatExample />  {/* Claude needs XML format examples */}
          <ThinkingInstructions />   {/* Claude supports thinking tags */}
        </SystemMessage>
        {super.renderRest()}
      </>
    );
  }
}
```

### Claude Tool Format

```tsx
class ToolUseFormatExample extends PromptElement {
  render() {
    return (
      <TextChunk priority={95}>
        When using tools, format calls as:
        {'<tool_name>\n<parameter_name>value</parameter_name>\n</tool_name>'}
        Wait for tool results before proceeding.
      </TextChunk>
    );
  }
}
```

## File: summarizedConversationHistory.tsx

### History Compaction

When conversation exceeds context window:

```typescript
class SummarizedConversationHistory extends PromptElement<{ history: IChatMessage[]; budget: number }> {
  async render() {
    const historyStr = JSON.stringify(this.props.history);
    const tokenCount = await countTokens(historyStr);

    if (tokenCount <= this.props.budget) {
      return <FullConversationHistory history={this.props.history} />;
    }

    // Summarize older messages, keep recent ones
    const splitPoint = findSplitPoint(this.props.history, this.props.budget * 0.3);
    const older = this.props.history.slice(0, splitPoint);
    const recent = this.props.history.slice(splitPoint);

    const summary = await summarizeMessages(older);

    return (
      <>
        <SystemMessage priority={45}>
          <TextChunk>Summary of earlier conversation: {summary}</TextChunk>
        </SystemMessage>
        <FullConversationHistory history={recent} />
      </>
    );
  }
}
```

## Adaptation for quiz

When migrating to quiz:

1. Replace "Copilot" with "quiz" in identity text
2. Keep tool instructions verbatim (model behavior)
3. Add quiz-specific capabilities description
4. Maintain priority values (tuned for performance)
5. Keep model-specific variants (Claude, GPT, Gemini)

```tsx
// quiz identity (example adaptation)
class QuizIdentity extends PromptElement {
  render() {
    return (
      <TextChunk priority={100}>
        You are quiz, an AI assistant integrated into the code editor.
        You have expert-level knowledge across programming languages.
        Use available tools to help users write, understand, and improve code.
        Follow the user's coding style and preferences.
      </TextChunk>
    );
  }
}
```
