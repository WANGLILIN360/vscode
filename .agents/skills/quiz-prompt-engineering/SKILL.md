---
name: quiz-prompt-engineering
description: "Prompt engineering for the Quiz AI assistant in VS Code Core. Use when (1) Creating or editing prompt builders for quiz chat/agent/inline modes, (2) Working with pure TypeScript prompt assembly in VS Code Core context, (3) Migrating Copilot Chat extension prompts to VS Code Core, (4) Implementing model-specific prompt routing or prompt registries, (5) Adding conversation history, workspace context, or tool instructions to prompts, (6) Designing context window management with priority-based pruning, (7) Creating agent mode system prompts with tool usage rules, or (8) Implementing conversation summarization for long sessions. IMPORTANT: Quiz is Core built-in code — it CANNOT use @vscode/prompt-tsx (npm package). Use pure TypeScript prompt builders instead."
---

# Quiz Prompt Engineering

Develop pure TypeScript prompt builders for Quiz in VS Code Core.

## ⚠️ CRITICAL: No TSX in Core

`@vscode/prompt-tsx` is an npm package used ONLY by the Copilot Chat extension (86 files). VS Code Core does NOT have `contrib/chat/common/prompts/promptTsx`. The only prompt-tsx related code in Core is `common/tools/promptTsxTypes.ts` — a small JSON serializer for tool result display, NOT a prompt rendering engine.

**Quiz must use pure TypeScript prompt builders** with string templates and priority-based assembly. Do NOT write TSX components like `PromptElement`, `SystemMessage`, `UserMessage` — these are extension-only APIs.

## Where Prompt Files Go

All Quiz prompt files live in the **Core contribution** directory:

```
src/vs/workbench/contrib/quiz/
├── common/prompt/              # Interfaces + types
│   ├── quizSystemPrompt.ts     # IQuizPromptBuilder interface
│   ├── quizToolPrompts.ts      # Tool prompt template data
│   ├── quizConversation.ts     # Conversation/Turn types
│   └── quizIntentDetector.ts   # IQuizIntentDetector interface
├── browser/prompt/             # Implementations (browser-safe)
│   ├── quizSystemPromptBuilder.ts
│   ├── quizToolPromptAssembler.ts
│   ├── quizConversationManager.ts
│   ├── quizIntentDetectorImpl.ts
│   └── quizFeedbackGenerator.ts
└── electron-browser/prompt/        # Native prompt rendering (Node.js)
    ├── quizNativePromptRenderer.ts  # Node.js optimized rendering (direct fs for prompt files)
    └── quizNativeTokenizer.ts       # Node.js tokenizer for accurate token counting
```

## Prompt Builder Pattern (Pure TypeScript)

```typescript
// common/prompt/quizSystemPrompt.ts
export interface IQuizPromptBuilder {
  buildSystemPrompt(options: QuizPromptOptions): string;
  buildToolDescriptions(tools: readonly QuizToolPromptInfo[]): string;
  buildContextSection(context: QuizContextInfo): string;
  assembleMessages(
    systemPrompt: string,
    history: readonly QuizChatMessage[],
    context: string,
    userQuery: string
  ): QuizChatMessage[];
}
```

## Priority System

Higher priority = kept longer when context window is exceeded:

| Priority Level | Use For |
|---|---|
| 100 | System identity, safety rules |
| 90 | Tool descriptions, critical instructions |
| 80 | Workspace context, user preferences |
| 60 | Current user query |
| 50 | Recent conversation history |
| 30-40 | Older messages, attachments |
| 1-20 | Optional context, summaries |

## System Prompt Builder

```typescript
// browser/prompt/quizSystemPromptBuilder.ts
export class QuizSystemPromptBuilder implements IQuizPromptBuilder {
  buildSystemPrompt(options: QuizPromptOptions): string {
    return `You are Quiz, an interactive learning and assessment AI assistant built into VS Code.

## Core Identity
- You are Quiz. You never reference, mention, or compare yourself to any other AI product or brand.
- Your purpose is to help users learn through interactive quizzes, explanations, and code challenges.

## Current Mode: ${options.mode.toUpperCase()}
${this.getModeInstructions(options.mode)}

## Difficulty Level: ${options.difficulty}
${this.getDifficultyInstructions(options.difficulty)}

${options.topic ? `## Focus Topic\n${options.topic}` : ''}

## Response Format
- Use markdown formatting
- Code examples use fenced code blocks with language identifiers
- Questions are numbered and include difficulty indicators
- Answers include explanations that teach, not just state the correct answer

## Tools
You have access to tools. Use them to:
- Generate structured quiz questions
- Evaluate user answers
- Search the codebase for relevant content
- Track learning progress
- Read and analyze files when the user shares code

## Safety
- Never generate harmful, offensive, or misleading content
- Never access files without user permission
- Never execute code without explicit user approval`;
  }

  buildToolDescriptions(tools: readonly QuizToolPromptInfo[]): string {
    return '## Available Tools\n\n' + tools.map(t =>
      `### ${t.name}\n${t.description}\nInput Schema: ${JSON.stringify(t.inputSchema)}`
    ).join('\n\n');
  }

  buildContextSection(context: QuizContextInfo): string {
    let section = '';
    if (context.activeFile) {
      section += `\nActive file: ${context.activeFile} (${context.activeLanguage ?? 'unknown'})`;
    }
    if (context.selectedCode) {
      section += `\nSelected code:\n\`\`\`${context.activeLanguage ?? ''}\n${context.selectedCode}\n\`\`\``;
    }
    if (context.diagnostics?.length) {
      section += `\nActive diagnostics:\n${context.diagnostics.map(d => `- [${d.severity}] ${d.file}:${d.line}: ${d.message}`).join('\n')}`;
    }
    return section;
  }

  assembleMessages(systemPrompt, history, context, userQuery): QuizChatMessage[] {
    const messages: QuizChatMessage[] = [
      { role: 'system', content: systemPrompt + (context ? '\n\n' + context : '') },
    ];
    for (const msg of history) { messages.push(msg); }
    messages.push({ role: 'user', content: userQuery });
    return messages;
  }
}
```

## Conversation Manager

```typescript
// browser/prompt/quizConversationManager.ts
// Manages conversation history with automatic compaction when context window fills up.
// Priority-based: older messages get lower priority and are pruned first.
export class QuizConversationManager implements IQuizConversationManager {
  private _turns: QuizTurn[] = [];

  addTurn(turn: QuizTurn): void {
    this._turns.push(turn);
    this._estimatedTokens += turn.tokenCount ?? this._estimateTokens(turn.content);
    if (this._estimatedTokens > MAX_CONTEXT_TOKENS * 0.8) {
      this.compact(); // Auto-compact when 80% full
    }
  }

  getHistory(maxTokens?: number): readonly QuizChatMessage[] {
    // Return messages, oldest first, respecting token budget
    // Lower priority messages are dropped first
  }

  async compact(): Promise<void> {
    // Keep first 2 and last 2 turns, summarize the middle
    // Equivalent to Copilot's summarizer.ts + backgroundSummarizer.ts
  }
}
```

## Intent Detection

```typescript
// browser/prompt/quizIntentDetectorImpl.ts
export class QuizIntentDetectorImpl implements IQuizIntentDetector {
  detectIntent(userMessage: string): QuizIntent {
    const msg = userMessage.toLowerCase().trim();
    // Pattern matching for 10 intent types:
    // generate_quiz, evaluate_answer, ask_question, review_code,
    // explain_concept, challenge, track_progress, fix, tests, general
  }
}
```

## Prompt Registry (Model-Specific Routing)

```typescript
// common/prompt/quizToolPrompts.ts
// Route prompts by model family — different models need different prompt formats
export interface IPromptResolver {
  readonly familyPrefixes: string[];
  resolvePrompt(modelId: string): IQuizPromptBuilder | undefined;
}

// browser/prompt/quizToolPromptAssembler.ts
export class QuizToolPromptAssembler {
  private resolvers: IPromptResolver[] = [
    new AnthropicPromptResolver(),   // Claude models need different formatting
    new OpenAIPromptResolver(),      // GPT models
    new GeminiPromptResolver(),      // Gemini models
  ];

  resolvePrompt(modelId: string): IQuizPromptBuilder {
    for (const resolver of this.resolvers) {
      if (resolver.familyPrefixes.some(p => modelId.startsWith(p))) {
        const builder = resolver.resolvePrompt(modelId);
        if (builder) return builder;
      }
    }
    return this.defaultBuilder;
  }
}
```

## What NOT to Do

- ❌ Do NOT use `PromptElement`, `SystemMessage`, `UserMessage` from `@vscode/prompt-tsx`
- ❌ Do NOT import from `vs/workbench/contrib/chat/common/prompts/promptTsx` (doesn't exist)
- ❌ Do NOT write `.tsx` files for prompts
- ❌ Do NOT use JSX syntax in prompt code

## Thinking Tokens 在 Prompt 中的处理

模型返回 thinking/reasoning tokens 时，prompt 系统需要正确处理：
对标 Copilot `platform/thinking/common/thinking.ts` + `platform/endpoint/common/thinkingDataContainer.tsx`。

```typescript
// common/prompt/quizThinkingPromptHandler.ts

export class QuizThinkingPromptHandler {
  /**
   * 在构建 prompt 时，根据模型能力决定是否启用 thinking：
   * - 支持 thinking 的模型：设置 enableThinking=true, reasoningEffort=用户选择
   * - 不支持 thinking 的模型：不设置 thinking 参数
   *
   * thinking 数据在 prompt 中的位置：
   * 1. 系统提示词中不需要提及 thinking
   * 2. 历史消息中的 thinking 块需要保留（作为 assistant 消息的一部分）
   * 3. compaction 时 thinking 块优先级低于正文
   */
  configureThinking(modelCapabilities: IQuizModelCapabilities, userPreference?: string): IQuizThinkingConfig {
    if (!modelCapabilities.thinking) {
      return { enabled: false };
    }

    return {
      enabled: true,
      reasoningEffort: userPreference ?? modelCapabilities.reasoningEffortLevels?.[0] ?? 'medium',
      // 加密 thinking：某些模型（如 o1）返回加密推理，不需要在 prompt 中处理
      // 但需要在 response parsing 时正确提取和存储
      includeInHistory: true,     // 历史消息中包含 thinking
      priority: PromptPriority.Low, // compaction 时 thinking 优先级最低
    };
  }
}

export interface IQuizThinkingConfig {
  readonly enabled: boolean;
  readonly reasoningEffort?: string;
  readonly includeInHistory?: boolean;
  readonly priority?: PromptPriority;
}
```

## Prompt Categorization Taxonomy（深度版）

对标 Copilot `prompt/common/promptCategorizationTaxonomy.ts` (21KB) — 15+ 意图分类的完整分类体系。
Quiz 需要扩展此体系以包含 Quiz 特有的意图。

```typescript
// common/prompt/quizPromptCategorizationTaxonomy.ts

export const QUIZ_INTENT_DEFINITIONS = {
  // ── 通用意图（来自 Copilot 分类法） ──
  explain: {
    description: '解释代码、概念或技术主题，包括澄清、总结、定义、逐步讲解',
    keywords: ['explanation', 'understanding', 'clarification', 'how-it-works', 'summary', 'definitions', 'step-by-step'],
  },
  find_content: {
    description: '检索、阅读或定位代码库中的文件、代码引用、定义和使用模式',
    keywords: ['retrieve', 'read', 'file contents', 'search', 'references', 'codebase', 'locate', 'fetch'],
  },
  research: {
    description: '研究现有代码或系统的实现细节、使用模式和文档',
    keywords: ['research', 'implementation details', 'documentation', 'usage patterns', 'investigation'],
  },
  review: {
    description: '审查代码质量、安全性、性能或最佳实践合规性',
    keywords: ['review', 'code review', 'quality', 'security', 'performance', 'best practices', 'audit'],
  },
  edit: {
    description: '修改现有代码，包括修复 bug、重构、添加功能',
    keywords: ['edit', 'modify', 'fix', 'refactor', 'change', 'update', 'patch', 'replace'],
  },
  generate: {
    description: '生成新代码、文件、项目结构或配置',
    keywords: ['generate', 'create', 'new', 'scaffold', 'bootstrap', 'init', 'write'],
  },
  debug: {
    description: '诊断和修复错误、分析堆栈跟踪、检查运行时行为',
    keywords: ['debug', 'error', 'bug', 'stack trace', 'diagnose', 'troubleshoot', 'fix error'],
  },
  test: {
    description: '编写、运行或分析测试用例',
    keywords: ['test', 'unit test', 'integration test', 'coverage', 'assertion', 'mock'],
  },
  document: {
    description: '生成或改进文档、注释、README',
    keywords: ['document', 'comment', 'readme', 'docstring', 'javadoc', 'documentation'],
  },
  configure: {
    description: '修改配置、设置、环境变量',
    keywords: ['configure', 'settings', 'config', 'environment', 'preference', 'options'],
  },
  optimize: {
    description: '优化性能、内存使用或代码效率',
    keywords: ['optimize', 'performance', 'efficiency', 'speed', 'memory', 'bottleneck'],
  },
  // ── Quiz 特有意图 ──
  challenge: {
    description: '生成测验题目、编程挑战或知识测试',
    keywords: ['quiz', 'challenge', 'question', 'test knowledge', 'assess', 'exercise', 'problem'],
  },
  evaluate: {
    description: '评估用户答案、代码质量或学习进度',
    keywords: ['evaluate', 'grade', 'score', 'assess answer', 'check answer', 'feedback on answer'],
  },
  teach: {
    description: '以教学方式解释概念，包含示例、类比和练习',
    keywords: ['teach', 'learn', 'tutorial', 'lesson', 'instruction', 'educational', 'analogy'],
  },
  track_progress: {
    description: '追踪学习进度、技能掌握程度和知识盲点',
    keywords: ['progress', 'track', 'mastery', 'knowledge gap', 'learning path', 'skill level'],
  },
} as const;

export type QuizIntent = keyof typeof QUIZ_INTENT_DEFINITIONS;

// 意图 → Agent 模式映射
export const QUIZ_INTENT_MODE_MAP: Record<QuizIntent, QuizAgentMode> = {
  explain: QuizAgentMode.Ask,
  find_content: QuizAgentMode.Ask,
  research: QuizAgentMode.Ask,
  review: QuizAgentMode.Review,
  edit: QuizAgentMode.Edit,
  generate: QuizAgentMode.Edit,
  debug: QuizAgentMode.Agent,
  test: QuizAgentMode.Agent,
  document: QuizAgentMode.Edit,
  configure: QuizAgentMode.Edit,
  optimize: QuizAgentMode.Agent,
  challenge: QuizAgentMode.Challenge,
  evaluate: QuizAgentMode.Challenge,
  teach: QuizAgentMode.Ask,
  track_progress: QuizAgentMode.Challenge,
};
```

## Reference Documents

- **Prompt patterns**: Read `references/prompt-tsx-api.md` for the TSX API that Copilot uses (for migration reference only — Quiz uses pure TS equivalents)
- **Copilot patterns**: Read `references/copilot-prompt-patterns.md` for migration patterns from Copilot Chat prompts
