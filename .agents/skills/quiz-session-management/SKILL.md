---
name: quiz-session-management
description: "Implement Quiz AI assistant session lifecycle management in VS Code Core — conversation persistence, checkpoints, metadata, feedback, BYOK, embeddings, semantic search, completions, inline edits, and all advanced features. Use when (1) Implementing session transcript recording and chat history building, (2) Working with checkpoint/worktree services for edit undo/redo, (3) Persisting session metadata across restarts, (4) Implementing feedback collection and reporting, (5) Building BYOK (Bring Your Own Key) provider support, (6) Implementing embeddings and semantic search, (7) Working with workspace recording and chunk search, (8) Implementing inline edits and completions integration, (9) Building debug logging and request correlation, (10) Implementing welcome messages and title generation, (11) Working with customization sync providers, (12) Managing external path confirmations, or (13) Any session lifecycle or advanced feature for Quiz."
---

# Quiz Session Management

Implement Quiz AI assistant session lifecycle management and ALL advanced features in VS Code Core at `src/vs/workbench/contrib/quiz/`.

## What This Skill Covers

This skill covers **everything not in the other 5 skills** — session persistence, checkpoints, metadata, feedback, BYOK, embeddings, semantic search, completions, inline edits, debug logging, customization sync, external path confirmation, welcome messages, and title generation. **No feature is optional.**

Other skills:
- **quiz-vscode-core-ai**: Registration, services, endpoints, parsers, auth, telemetry
- **quiz-prompt-engineering**: Prompt building, conversation management
- **quiz-agent-tools**: Individual tool implementations
- **quiz-chat-ui**: UI widgets and views
- **quiz-agent-runtime**: Tool calling loop, hooks, agent providers

This skill: **session lifecycle + all advanced features**.

## Directory Structure

```
contrib/quiz/
├── common/session/                          # Session lifecycle
│   ├── quizSessionTranscript.ts             # Structured conversation transcript
│   ├── quizChatHistoryBuilder.ts            # Transcript → LLM message array
│   ├── quizSessionMetadataStore.ts          # IQuizSessionMetadataStore interface
│   └── quizSessionTypes.ts                 # Session data types
├── common/checkpoint/                       # Edit undo/redo
│   ├── quizCheckpointService.ts             # IQuizCheckpointService interface
│   └── quizCheckpointTypes.ts              # Checkpoint data types
├── common/feedback/                         # User feedback
│   ├── quizFeedbackService.ts              # IQuizFeedbackService interface
│   └── quizFeedbackTypes.ts               # Feedback types
├── common/byok/                             # Bring Your Own Key
│   ├── quizByokService.ts                  # IQuizByokService interface
│   ├── quizByokTypes.ts                    # BYOK provider types
│   ├── quizByokMessageConverter.ts         # Message format converters
│   ├── quizAnthropicMessageConverter.ts    # Anthropic format converter
│   ├── quizGeminiMessageConverter.ts       # Gemini format converter
│   └── quizOpenAIMessageConverter.ts       # OpenAI format converter
├── common/embeddings/                       # Vector embeddings
│   ├── quizEmbeddingsComputer.ts           # IQuizEmbeddingsComputer interface
│   ├── quizEmbeddingsIndex.ts              # IQuizEmbeddingsIndex interface
│   ├── quizEmbeddingsGrouper.ts            # Embedding grouping/clustering
│   ├── quizEmbeddingsStorage.ts            # IQuizEmbeddingsStorage interface
│   └── quizRemoteEmbeddingsComputer.ts     # Remote embeddings API
├── common/semanticSearch/                   # Semantic code search
│   ├── quizSemanticSearchService.ts        # IQuizSemanticSearchService interface
│   ├── quizCombinedRank.ts                 # Combined ranking algorithm
│   └── quizSemanticSearchTypes.ts          # Search result types
├── common/workspaceSearch/                  # Workspace search
│   ├── quizWorkspaceChunkSearch.ts         # IQuizWorkspaceChunkSearchService interface
│   └── quizWorkspaceIndexingStatus.ts      # IQuizIndexingStatus interface
├── common/workspaceRecorder/                # Workspace change tracking
│   ├── quizWorkspaceRecorder.ts            # IQuizWorkspaceRecorder interface
│   └── quizWorkspaceListenerService.ts     # IQuizWorkspaceListenerService interface
├── common/debug/                            # Debug logging
│   ├── quizDebugLogger.ts                  # IQuizDebugLogger interface
│   ├── quizRequestLogger.ts                # IQuizRequestLogger interface
│   └── quizRequestCorrelation.ts           # Correlation ID tracking
├── common/customization/                    # Customization sync
│   ├── quizCustomizationSyncProvider.ts    # IQuizCustomizationSyncProvider interface
│   ├── quizCustomizationItemProvider.ts    # IQuizCustomizationItemProvider interface
│   └── quizCustomizationBundler.ts         # IQuizCustomizationBundler interface
├── common/inlineEdits/                      # Inline edit suggestions
│   ├── quizInlineEditService.ts            # IQuizInlineEditService interface
│   └── quizInlineEditTypes.ts             # Inline edit data types
├── common/completions/                      # Code completions
│   ├── quizCompletionService.ts            # IQuizCompletionService interface
│   └── quizCompletionTypes.ts             # Completion data types
├── common/titleGeneration/                  # Auto title
│   └── quizTitleProvider.ts                # IQuizTitleProvider interface
├── common/welcome/                          # Welcome messages
│   └── quizWelcomeMessageProvider.ts       # IQuizWelcomeMessageProvider interface
├── common/terminalFix/                      # Terminal fix suggestions
│   └── quizTerminalFixGenerator.ts         # IQuizTerminalFixGenerator interface
├── common/modelAccess/                      # Model access & quota
│   ├── quizModelAccessService.ts           # IQuizModelAccessService interface
│   └── quizChatQuotaService.ts             # IQuizChatQuotaService interface
├── browser/session/                         # Browser implementations
│   ├── quizSessionTranscriptImpl.ts        # Transcript implementation
│   ├── quizChatHistoryBuilderImpl.ts       # History builder implementation
│   ├── quizSessionMetadataStoreImpl.ts     # Metadata store (IndexedDB)
│   ├── quizFeedbackServiceImpl.ts          # Feedback implementation
│   ├── quizTitleProviderImpl.ts            # Title generation implementation
│   ├── quizWelcomeMessageProviderImpl.ts   # Welcome message implementation
│   ├── quizTerminalFixGeneratorImpl.ts     # Terminal fix implementation
│   ├── quizModelAccessServiceImpl.ts       # Model access implementation
│   ├── quizChatQuotaServiceImpl.ts         # Quota tracking implementation
│   └── quizDebugLoggerImpl.ts              # Debug logger implementation
├── browser/customization/                   # Customization implementations
│   ├── quizCustomizationSyncProviderImpl.ts
│   ├── quizCustomizationItemProviderImpl.ts
│   └── quizCustomizationBundlerImpl.ts
├── browser/byok/                            # BYOK web implementations
│   ├── quizByokContribution.ts             # BYOK registration contribution
│   └── quizByokStorageService.ts           # Key storage (SecretStorage)
├── browser/embeddings/                      # Embeddings web implementations
│   ├── quizRemoteEmbeddingsComputerImpl.ts # Remote API embeddings (web-safe)
│   └── quizEmbeddingsStorageImpl.ts        # Storage implementation (IndexedDB)
├── browser/semanticSearch/                  # Semantic search web implementations
│   └── quizSemanticSearchServiceImpl.ts    # Semantic search (remote embeddings)
├── browser/workspaceSearch/                 # Workspace search browser implementations
│   └── quizWorkspaceSearchCommands.ts      # Search command registration (UI layer)
├── browser/inlineEdits/                     # Inline edits implementations
│   ├── quizInlineEditServiceImpl.ts
│   └── quizInlineEditWidget.ts             # Inline edit rendering
├── electron-browser/session/                # Electron implementations
│   ├── quizNativeSessionTranscriptImpl.ts  # File-based transcript
│   ├── quizNativeSessionMetadataStoreImpl.ts # File-based metadata
│   └── quizNativeRequestLoggerImpl.ts      # File-based request logging
├── electron-browser/checkpoint/             # Checkpoint implementations
│   ├── quizCheckpointServiceImpl.ts        # Git worktree checkpoint service (38KB)
│   └── quizExternalEditTrackerImpl.ts      # External edit tracking
├── electron-browser/confirmation/           # Path confirmation
│   └── quizExternalPathConfirmation.ts     # External file access approval
├── electron-browser/byok/                   # Native BYOK (Node.js HTTP)
│   ├── quizAbstractLanguageModelChatProvider.ts  # Base LM chat provider
│   ├── quizByokServiceImpl.ts              # BYOK service implementation
│   ├── quizByokModelInfo.ts               # Model info for BYOK models
│   ├── quizAnthropicProvider.ts            # Anthropic API provider (39KB)
│   ├── quizAzureProvider.ts                # Azure OpenAI provider
│   ├── quizCustomOAIProvider.ts            # Custom OpenAI-compatible provider
│   ├── quizGeminiNativeProvider.ts         # Google Gemini provider (26KB)
│   ├── quizOllamaProvider.ts              # Ollama local provider
│   ├── quizOpenAIProvider.ts              # OpenAI provider
│   ├── quizOpenRouterProvider.ts          # OpenRouter provider
│   └── quizXAIProvider.ts                 # xAI/Grok provider
├── electron-browser/embeddings/             # Native embeddings (Node.js ONNX)
│   ├── quizNativeEmbeddingsComputerImpl.ts # Node.js ONNX embeddings
│   ├── quizEmbeddingsComputerImpl.ts       # Local embeddings computation
│   ├── quizEmbeddingsIndexImpl.ts          # Embedding index (HNSW)
│   ├── quizEmbeddingsGrouperImpl.ts        # Grouping implementation
│   └── quizVscodeIndexImpl.ts             # VS Code workspace index
├── electron-browser/semanticSearch/         # Native semantic search
│   └── quizSemanticSearchTextSearchProvider.ts  # Native text search provider
├── electron-browser/workspaceSearch/        # Native workspace search (Node.js fs)
│   ├── quizWorkspaceChunkSearchImpl.ts
│   └── quizWorkspaceIndexingStatusImpl.ts
├── electron-browser/workspaceRecorder/      # Native workspace recorder (Node.js fs.watch)
│   ├── quizWorkspaceRecorderImpl.ts
│   ├── quizListenerServiceImpl.ts
│   ├── quizSafeFileWriteUtils.ts           # Atomic file write (Node.js fs)
│   └── quizUtilsObservable.ts             # Observable file change utils
└── electron-browser/completions/            # Native completions (Node.js)
    ├── quizNativeCompletionServiceImpl.ts  # Node.js completion engine
    └── quizCompletionServiceImpl.ts
```

## 1. Session Transcript

Records the structured conversation including tool call rounds, token usage, and hook results.

```typescript
// common/session/quizSessionTranscript.ts
export const IQuizSessionTranscriptService = createDecorator<IQuizSessionTranscriptService>(
  'quizSessionTranscriptService'
);

export interface IQuizSessionTranscriptService {
  readonly _serviceBrand: undefined;

  recordTurn(sessionId: string, turn: IQuizHistoricalTurn): void;
  getTranscript(sessionId: string): IQuizSessionTranscript;
  clearTranscript(sessionId: string): void;
}

export interface IQuizSessionTranscript {
  readonly sessionId: string;
  readonly turns: readonly IQuizHistoricalTurn[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IQuizHistoricalTurn {
  readonly id: string;
  readonly request: IQuizTurnRequest;
  readonly response: IQuizTurnResponse;
  readonly toolCallRounds: readonly IQuizToolCallRound[];
  readonly tokenUsage: IQuizTokenUsage;
  readonly timestamp: number;
  readonly duration: number;
  readonly hookResults?: IQuizHookResult[];
  readonly compactionMetadata?: IQuizCompactionMetadata;
}

export interface IQuizTurnRequest {
  readonly message: string;
  readonly intent: QuizIntent;
  readonly mode: QuizAgentMode;
  readonly references: readonly IQuizReference[];
  readonly toolReferences: readonly IQuizToolReference[];
}

export interface IQuizTurnResponse {
  readonly status: 'success' | 'error' | 'filtered' | 'cancelled';
  readonly message: string;
  readonly error?: string;
}

export interface IQuizCompactionMetadata {
  readonly compactedTurnCount: number;
  readonly summaryTokenCount: number;
  readonly originalTokenCount: number;
}
```

## 2. Chat History Builder

Converts the session transcript into the message array sent to the LLM.

```typescript
// common/session/quizChatHistoryBuilder.ts
export const IQuizChatHistoryBuilder = createDecorator<IQuizChatHistoryBuilder>(
  'quizChatHistoryBuilder'
);

export interface IQuizChatHistoryBuilder {
  readonly _serviceBrand: undefined;

  buildMessages(
    transcript: IQuizSessionTranscript,
    maxTokens: number,
    options: IQuizHistoryBuildOptions
  ): IQuizChatMessage[];

  compactHistory(
    transcript: IQuizSessionTranscript,
    targetTokens: number
  ): Promise<IQuizCompactionResult>;
}

export interface IQuizHistoryBuildOptions {
  readonly includeToolResults: boolean;
  readonly includeThinking: boolean;
  readonly maxRounds: number;
  readonly format: 'openai' | 'anthropic' | 'gemini';
}

export interface IQuizCompactionResult {
  readonly compactedTranscript: IQuizSessionTranscript;
  readonly savedTokens: number;
  readonly summary: string;
}
```

## 3. Session Metadata Store

Persists session metadata across VS Code restarts.

```typescript
// common/session/quizSessionMetadataStore.ts
export const IQuizSessionMetadataStore = createDecorator<IQuizSessionMetadataStore>(
  'quizSessionMetadataStore'
);

export interface IQuizSessionMetadataStore {
  readonly _serviceBrand: undefined;

  storeMetadata(sessionId: string, metadata: IQuizSessionMetadata): Promise<void>;
  getMetadata(sessionId: string): Promise<IQuizSessionMetadata | undefined>;
  getAllMetadata(): Promise<readonly IQuizSessionMetadata[]>;
  deleteMetadata(sessionId: string): Promise<void>;
}

export interface IQuizSessionMetadata {
  readonly sessionId: string;
  readonly title: string;
  readonly model: string;
  readonly mode: QuizAgentMode;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tokenUsageSummary: IQuizTokenUsageSummary;
  readonly customizationState: IQuizCustomizationState;
  readonly repositoryPath?: string;
  readonly workspaceFolder?: string;
}

export interface IQuizTokenUsageSummary {
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly requestCount: number;
}
```

## 4. Checkpoint / Worktree Service

When the agent edits files, saves checkpoints for undo/redo.

```typescript
// common/checkpoint/quizCheckpointService.ts
export const IQuizCheckpointService = createDecorator<IQuizCheckpointService>(
  'quizCheckpointService'
);

export interface IQuizCheckpointService {
  readonly _serviceBrand: undefined;

  createWorktree(
    repositoryPath: URI,
    stream?: IQuizResponseStream,
    baseBranch?: string,
    branchName?: string
  ): Promise<IQuizWorktreeProperties | undefined>;

  getWorktreeProperties(sessionId: string): Promise<IQuizWorktreeProperties | undefined>;

  createCheckpoint(sessionId: string, message: string): Promise<IQuizCheckpoint | undefined>;

  restoreCheckpoint(sessionId: string, checkpointId: string): Promise<boolean>;

  getCheckpoints(sessionId: string): Promise<readonly IQuizCheckpoint[]>;

  disposeWorktree(sessionId: string): Promise<void>;
}

export interface IQuizWorktreeProperties {
  readonly baseCommit: string;
  readonly branchName: string;
  readonly baseBranchName: string;
  readonly repositoryPath: string;
  readonly worktreePath: string;
  readonly firstCheckpointRef?: string;
  readonly lastCheckpointRef?: string;
  readonly changes?: readonly IQuizWorktreeFile[];
}

export interface IQuizWorktreeFile {
  readonly filePath: string;
  readonly originalFilePath: string | undefined;
  readonly modifiedFilePath: string | undefined;
  readonly statistics: { readonly additions: number; readonly deletions: number };
}

export interface IQuizCheckpoint {
  readonly id: string;
  readonly ref: string;
  readonly message: string;
  readonly timestamp: number;
  readonly fileChanges: readonly IQuizWorktreeFile[];
}
```

## 5. Feedback Collection

```typescript
// common/feedback/quizFeedbackService.ts
export const IQuizFeedbackService = createDecorator<IQuizFeedbackService>('quizFeedbackService');

export interface IQuizFeedbackService {
  readonly _serviceBrand: undefined;

  handleFeedback(feedback: IQuizFeedback): void;
  handleUserAction(action: IQuizUserAction): void;
  canReportIssues(): boolean;
  reportIssue(issue: IQuizIssueReport): Promise<void>;
}

export interface IQuizFeedback {
  readonly sessionId: string;
  readonly requestId: string;
  readonly kind: 'helpful' | 'unhelpful';
}

export interface IQuizUserAction {
  readonly sessionId: string;
  readonly requestId: string;
  readonly action: 'copy' | 'insert' | 'run' | 'retry';
}

export interface IQuizIssueReport {
  readonly sessionId: string;
  readonly requestId: string;
  readonly category: 'incorrect' | 'offensive' | 'harmful' | 'other';
  readonly description: string;
}
```

## 6. BYOK (Bring Your Own Key)

Support for custom API keys and endpoints — Anthropic, Azure, Gemini, Ollama, OpenAI, OpenRouter, xAI.

```typescript
// common/byok/quizByokService.ts
export const IQuizByokService = createDecorator<IQuizByokService>('quizByokService');

export interface IQuizByokService {
  readonly _serviceBrand: undefined;

  registerProvider(provider: IQuizByokProvider): IDisposable;
  getProviders(): readonly IQuizByokProviderInfo[];
  getProvider(id: string): IQuizByokProvider | undefined;
  storeApiKey(providerId: string, key: string): Promise<void>;
  getApiKey(providerId: string): Promise<string | undefined>;
  removeApiKey(providerId: string): Promise<void>;
}

export interface IQuizByokProvider {
  readonly id: string;
  readonly displayName: string;
  readonly icon: Codicon;
  readonly models: readonly IQuizByokModelInfo[];
  readonly capabilities: IQuizByokCapabilities;
  createChatRequest(model: string, messages: IQuizChatMessage[], options: IQuizByokRequestOptions): AsyncIterable<IQuizByokResponseChunk>;
}

export interface IQuizByokModelInfo {
  readonly id: string;
  readonly name: string;
  readonly vendor: string;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly supportsToolCalling: boolean;
  readonly supportsVision: boolean;
  readonly supportsThinking: boolean;
}

export interface IQuizByokCapabilities {
  readonly toolCalling: boolean;
  readonly vision: boolean;
  readonly streaming: boolean;
  readonly thinking: boolean;
}

export interface IQuizByokRequestOptions {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly tools?: IQuizToolInfo[];
  readonly temperature?: number;
  readonly reasoningEffort?: string;
}
```

### Message Converters

Each BYOK provider needs a message format converter to translate Quiz's internal message format to the provider's API format:

```typescript
// common/byok/quizAnthropicMessageConverter.ts
// Converts IQuizChatMessage[] → Anthropic Messages API format
export class QuizAnthropicMessageConverter {
  convert(messages: IQuizChatMessage[]): AnthropicMessage[] { ... }
  convertToolCalls(calls: IQuizToolCall[]): AnthropicToolUseBlock[] { ... }
  convertToolResults(results: IQuizToolResult[]): AnthropicToolResultBlock[] { ... }
}

// common/byok/quizGeminiMessageConverter.ts
// Converts IQuizChatMessage[] → Google Gemini API format
export class QuizGeminiMessageConverter {
  convert(messages: IQuizChatMessage[]): GeminiContent[] { ... }
  convertFunctionDeclarations(tools: IQuizToolInfo[]): GeminiFunctionDeclaration[] { ... }
}

// common/byok/quizOpenAIMessageConverter.ts
// Converts IQuizChatMessage[] → OpenAI Chat Completions API format
export class QuizOpenAIMessageConverter {
  convert(messages: IQuizChatMessage[]): OpenAIChatMessage[] { ... }
  convertFunctionDefinitions(tools: IQuizToolInfo[]): OpenAIFunctionDefinition[] { ... }
}
```

## 7. Embeddings

Vector embeddings for semantic code search.

```typescript
// common/embeddings/quizEmbeddingsComputer.ts
export const IQuizEmbeddingsComputer = createDecorator<IQuizEmbeddingsComputer>('quizEmbeddingsComputer');

export interface IQuizEmbeddingsComputer {
  readonly _serviceBrand: undefined;

  computeEmbeddings(inputs: string[], type: QuizEmbeddingType): Promise<IQuizEmbedding[]>;
  getEmbeddingDimension(type: QuizEmbeddingType): number;
}

export const enum QuizEmbeddingType {
  CodeSearch = 'codeSearch',
  TextSearch = 'textSearch',
}

export interface IQuizEmbedding {
  readonly values: readonly number[];
  readonly input: string;
  readonly type: QuizEmbeddingType;
}

// common/embeddings/quizEmbeddingsIndex.ts
export const IQuizEmbeddingsIndex = createDecorator<IQuizEmbeddingsIndex>('quizEmbeddingsIndex');

export interface IQuizEmbeddingsIndex {
  readonly _serviceBrand: undefined;

  indexFile(uri: URI, content: string): Promise<void>;
  removeFile(uri: URI): Promise<void>;
  search(query: string, topK: number): Promise<IQuizSearchResult[]>;
  getIndexStats(): IQuizIndexStats;
}

export interface IQuizSearchResult {
  readonly uri: URI;
  readonly score: number;
  readonly snippet: string;
  readonly lineNumber: number;
}

export interface IQuizIndexStats {
  readonly fileCount: number;
  readonly totalChunks: number;
  readonly indexSize: number;
}

// common/embeddings/quizEmbeddingsGrouper.ts
// Groups embeddings by semantic similarity for efficient retrieval
export const IQuizEmbeddingsGrouper = createDecorator<IQuizEmbeddingsGrouper>('quizEmbeddingsGrouper');

export interface IQuizEmbeddingsGrouper {
  readonly _serviceBrand: undefined;
  groupEmbeddings(embeddings: IQuizEmbedding[]): IQuizEmbeddingGroup[];
  mergeGroups(groups: IQuizEmbeddingGroup[]): IQuizEmbeddingGroup[];
}

export interface IQuizEmbeddingGroup {
  readonly id: string;
  readonly embeddings: readonly IQuizEmbedding[];
  readonly centroid: readonly number[];
  readonly label: string;
}
```

## 8. Semantic Search

```typescript
// common/semanticSearch/quizSemanticSearchService.ts
export const IQuizSemanticSearchService = createDecorator<IQuizSemanticSearchService>(
  'quizSemanticSearchService'
);

export interface IQuizSemanticSearchService {
  readonly _serviceBrand: undefined;

  search(query: string, options: IQuizSemanticSearchOptions): Promise<IQuizSemanticSearchResult[]>;
  indexWorkspace(): Promise<void>;
  getSearchProvider(): IQuizTextSearchProvider;
}

export interface IQuizSemanticSearchOptions {
  readonly maxResults: number;
  readonly includePattern?: string;
  readonly excludePattern?: string;
  readonly folder?: URI;
}

export interface IQuizSemanticSearchResult {
  readonly uri: URI;
  readonly ranges: readonly IQuizSearchRange[];
  readonly score: number;
  readonly snippet: string;
}

export interface IQuizSearchRange {
  readonly startLine: number;
  readonly startCol: number;
  readonly endLine: number;
  readonly endCol: number;
}

// common/semanticSearch/quizCombinedRank.ts
// Combines BM25 (keyword) + semantic (embedding) scores
export class QuizCombinedRank {
  rank(
    keywordResults: IQuizSearchResult[],
    semanticResults: IQuizSemanticSearchResult[],
    weights: { keyword: number; semantic: number }
  ): IQuizSemanticSearchResult[] { ... }
}
```

## 9. Workspace Chunk Search

```typescript
// common/workspaceSearch/quizWorkspaceChunkSearch.ts
export const IQuizWorkspaceChunkSearchService = createDecorator<IQuizWorkspaceChunkSearchService>(
  'quizWorkspaceChunkSearchService'
);

export interface IQuizWorkspaceChunkSearchService {
  readonly _serviceBrand: undefined;

  searchChunks(query: string, options: IQuizChunkSearchOptions): Promise<IQuizChunkResult[]>;
  getIndexingStatus(): IQuizIndexingStatus;
}

export interface IQuizChunkSearchOptions {
  readonly maxResults: number;
  readonly chunkSize: number;
  readonly overlap: number;
}

export interface IQuizChunkResult {
  readonly uri: URI;
  readonly chunk: string;
  readonly score: number;
  readonly startLine: number;
  readonly endLine: number;
}

export interface IQuizIndexingStatus {
  readonly state: 'idle' | 'indexing' | 'complete' | 'error';
  readonly progress: number;
  readonly totalFiles: number;
  readonly indexedFiles: number;
}
```

## 10. Workspace Recorder

Tracks file changes in the workspace for context awareness.

```typescript
// common/workspaceRecorder/quizWorkspaceRecorder.ts
export const IQuizWorkspaceRecorder = createDecorator<IQuizWorkspaceRecorder>('quizWorkspaceRecorder');

export interface IQuizWorkspaceRecorder {
  readonly _serviceBrand: undefined;

  startRecording(): void;
  stopRecording(): void;
  getRecordedChanges(): readonly IQuizWorkspaceChange[];
  onDidChangeWorkspace: Event<IQuizWorkspaceChange>;
}

export interface IQuizWorkspaceChange {
  readonly uri: URI;
  readonly type: 'create' | 'modify' | 'delete';
  readonly timestamp: number;
  readonly content?: string;
}
```

## 11. Debug Logger

```typescript
// common/debug/quizDebugLogger.ts
export const IQuizDebugLogger = createDecorator<IQuizDebugLogger>('quizDebugLogger');

export interface IQuizDebugLogger {
  readonly _serviceBrand: undefined;

  logRequest(sessionId: string, request: IQuizDebugRequest): void;
  logResponse(sessionId: string, response: IQuizDebugResponse): void;
  logToolCall(sessionId: string, toolCall: IQuizDebugToolCall): void;
  getLogEntries(sessionId: string): readonly IQuizLogEntry[];
  clearLog(sessionId: string): void;
  exportLog(sessionId: string): Promise<URI>;
}

export interface IQuizDebugRequest {
  readonly requestId: string;
  readonly messages: IQuizChatMessage[];
  readonly tokenCount: number;
  readonly model: string;
  readonly timestamp: number;
}

export interface IQuizDebugResponse {
  readonly requestId: string;
  readonly status: 'success' | 'error';
  readonly tokenUsage: IQuizTokenUsage;
  readonly duration: number;
  readonly toolCalls?: IQuizToolCall[];
}

export interface IQuizDebugToolCall {
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly result: IQuizToolResult;
  readonly duration: number;
}

export interface IQuizLogEntry {
  readonly timestamp: number;
  readonly type: 'request' | 'response' | 'toolCall' | 'error';
  readonly data: unknown;
}

// common/debug/quizRequestLogger.ts
export const IQuizRequestLogger = createDecorator<IQuizRequestLogger>('quizRequestLogger');

export interface IQuizRequestLogger {
  readonly _serviceBrand: undefined;

  createCorrelationId(): string;
  logWithCorrelation(correlationId: string, event: string, data: unknown): void;
  captureToken(correlationId: string): CancellationToken;
}
```

## 12. Customization Sync

```typescript
// common/customization/quizCustomizationSyncProvider.ts
export const IQuizCustomizationSyncProvider = createDecorator<IQuizCustomizationSyncProvider>(
  'quizCustomizationSyncProvider'
);

export interface IQuizCustomizationSyncProvider {
  readonly _serviceBrand: undefined;

  getCustomizations(): IQuizCustomizationRef[];
  onDidChange: Event<void>;
  pushCustomization(ref: IQuizCustomizationRef): Promise<void>;
  pullCustomizations(): Promise<IQuizCustomizationRef[]>;
}

export interface IQuizCustomizationRef {
  readonly id: string;
  readonly type: 'instruction' | 'prompt' | 'skill' | 'slashCommand';
  readonly label: string;
  readonly content: string;
  readonly enabled: boolean;
}

// common/customization/quizCustomizationItemProvider.ts
export const IQuizCustomizationItemProvider = createDecorator<IQuizCustomizationItemProvider>(
  'quizCustomizationItemProvider'
);

export interface IQuizCustomizationItemProvider {
  readonly _serviceBrand: undefined;

  getItems(): IQuizCustomizationItem[];
  onDidChangeItems: Event<void>;
}

export interface IQuizCustomizationItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly type: 'instruction' | 'prompt' | 'skill' | 'slashCommand';
  readonly source: 'user' | 'workspace' | 'builtIn';
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

// common/customization/quizCustomizationBundler.ts
export const IQuizCustomizationBundler = createDecorator<IQuizCustomizationBundler>(
  'quizCustomizationBundler'
);

export interface IQuizCustomizationBundler {
  readonly _serviceBrand: undefined;

  bundleCustomizations(refs: IQuizCustomizationRef[]): IQuizCustomizationBundle;
}

export interface IQuizCustomizationBundle {
  readonly instructions: string;
  readonly prompts: readonly IQuizCustomizationRef[];
  readonly skills: readonly IQuizCustomizationRef[];
  readonly slashCommands: readonly IQuizCustomizationRef[];
}
```

## 13. Inline Edits

```typescript
// common/inlineEdits/quizInlineEditService.ts
export const IQuizInlineEditService = createDecorator<IQuizInlineEditService>('quizInlineEditService');

export interface IQuizInlineEditService {
  readonly _serviceBrand: undefined;

  provideInlineEdits(uri: URI, position: IQuizPosition, context: IQuizInlineEditContext): Promise<IQuizInlineEdit[]>;
  applyInlineEdit(edit: IQuizInlineEdit): Promise<boolean>;
  rejectInlineEdit(edit: IQuizInlineEdit): void;
}

export interface IQuizInlineEdit {
  readonly id: string;
  readonly uri: URI;
  readonly range: IQuizRange;
  readonly newText: string;
  readonly originalText: string;
  readonly confidence: number;
}

export interface IQuizInlineEditContext {
  readonly triggerKind: 'automatic' | 'invoked';
  readonly selectedText?: string;
  readonly diagnostics?: IQuizDiagnostic[];
}
```

## 14. Completions

```typescript
// common/completions/quizCompletionService.ts
export const IQuizCompletionService = createDecorator<IQuizCompletionService>('quizCompletionService');

export interface IQuizCompletionService {
  readonly _serviceBrand: undefined;

  provideInlineCompletions(
    model: IQuizTextModel,
    position: IQuizPosition,
    context: IQuizCompletionContext,
    token: CancellationToken
  ): Promise<IQuizInlineCompletion[]>;

  handleDidShowCompletion(completion: IQuizInlineCompletion): void;
  handleDidAcceptCompletion(completion: IQuizInlineCompletion): void;
}

export interface IQuizInlineCompletion {
  readonly id: string;
  readonly insertText: string;
  readonly range: IQuizRange;
  readonly command?: IQuizCommand;
}

export interface IQuizCompletionContext {
  readonly triggerKind: 'invoke' | 'automatic';
  readonly selectedCompletionInfo?: { text: string; range: IQuizRange };
}
```

## 15. Title Provider

```typescript
// common/titleGeneration/quizTitleProvider.ts
export const IQuizTitleProvider = createDecorator<IQuizTitleProvider>('quizTitleProvider');

export interface IQuizTitleProvider {
  readonly _serviceBrand: undefined;

  provideTitle(firstMessage: string, mode: QuizAgentMode): Promise<string>;
}
```

## 16. Welcome Message

```typescript
// common/welcome/quizWelcomeMessageProvider.ts
export const IQuizWelcomeMessageProvider = createDecorator<IQuizWelcomeMessageProvider>(
  'quizWelcomeMessageProvider'
);

export interface IQuizWelcomeMessageProvider {
  readonly _serviceBrand: undefined;

  getWelcomeMessage(): IQuizWelcomeMessage;
  getAdditionalWelcomeContent(): string;
}

export interface IQuizWelcomeMessage {
  readonly title: string;
  readonly description: string;
  readonly commands: readonly IQuizWelcomeCommand[];
  readonly tips: readonly string[];
}

export interface IQuizWelcomeCommand {
  readonly label: string;
  readonly commandId: string;
  readonly description: string;
}
```

## 17. Terminal Fix Generator

```typescript
// common/terminalFix/quizTerminalFixGenerator.ts
export const IQuizTerminalFixGenerator = createDecorator<IQuizTerminalFixGenerator>(
  'quizTerminalFixGenerator'
);

export interface IQuizTerminalFixGenerator {
  readonly _serviceBrand: undefined;

  generateFix(terminalOutput: string, command: string): Promise<IQuizTerminalFix | undefined>;
}

export interface IQuizTerminalFix {
  readonly explanation: string;
  readonly suggestedCommand: string;
  readonly confidence: number;
}
```

## 18. Model Access / Quota

```typescript
// common/modelAccess/quizModelAccessService.ts
export const IQuizModelAccessService = createDecorator<IQuizModelAccessService>('quizModelAccessService');

export interface IQuizModelAccessService {
  readonly _serviceBrand: undefined;

  getModelCapabilities(modelId: string): IQuizModelCapabilities;
  getConfigurationSchema(modelId: string): IQuizConfigurationSchema | undefined;
  shouldAutoDowngrade(error: IQuizModelError): boolean;
  getAlternativeModel(modelId: string): string | undefined;
}

export interface IQuizModelCapabilities {
  readonly toolCalling: boolean;
  readonly vision: boolean;
  readonly thinking: boolean;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly reasoningEffortLevels?: string[];
}

export interface IQuizConfigurationSchema {
  readonly properties: Record<string, IQuizConfigProperty>;
}

export interface IQuizConfigProperty {
  readonly type: string;
  readonly title: string;
  readonly enum?: string[];
  readonly enumItemLabels?: string[];
  readonly default?: string;
}

// common/modelAccess/quizChatQuotaService.ts
export const IQuizChatQuotaService = createDecorator<IQuizChatQuotaService>('quizChatQuotaService');

export interface IQuizChatQuotaService {
  readonly _serviceBrand: undefined;

  getQuotaStatus(): IQuizQuotaStatus;
  onDidChangeQuota: Event<IQuizQuotaStatus>;
  checkQuota(): Promise<boolean>;
}

export interface IQuizQuotaStatus {
  readonly remaining: number;
  readonly total: number;
  readonly resetDate: Date;
  readonly isQuotaExceeded: boolean;
}
```

## 19. External Path Confirmation

```typescript
// electron-browser/confirmation/quizExternalPathConfirmation.ts
// Reuses Core's ChatExternalPathConfirmationContribution pattern
// from contrib/chat/electron-browser/builtInTools/tools.ts

// Register for quiz_readFile and quiz_listDir tools:
// confirmationService.registerConfirmationContribution('quiz_readFile', externalPathConfirmation);
// confirmationService.registerConfirmationContribution('quiz_listDir', externalPathConfirmation);
```

## Integration: How Session Management Connects

```
quizServiceImpl.handleRequest()
  │
  ├─→ sessionTranscript.recordTurn()          ← Record each turn
  ├─→ chatHistoryBuilder.buildMessages()      ← Build LLM messages from transcript
  ├─→ toolCallingLoop.run()                   ← Execute agent loop
  │     ├─→ checkpointService.createCheckpoint()  ← Before each edit
  │     ├─→ feedbackService.handleFeedback()       ← User feedback
  │     ├─→ debugLogger.logRequest/Response()      ← Debug logging
  │     ├─→ chatDebugService.logEvent()            ← Core debug service 集成
  │     └─→ permissionService.shouldConfirm()      ← Tool permission check
  ├─→ titleProvider.provideTitle()            ← Auto-generate title
  ├─→ metadataStore.storeMetadata()           ← Persist session metadata
  ├─→ quotaService.checkQuota()               ← Check quota before request
  ├─→ interactionService.startInteraction()   ← 逻辑交互追踪（telemetry 用）
  └─→ blockedExtensionService.check()         ← 检查扩展是否被临时屏蔽
```

## 20. Configuration Migration

设置版本迁移。对标 Copilot `extension/configuration/vscode-node/configurationMigration.ts` (6.5KB)。

```typescript
// browser/quizConfigurationMigration.ts
// 在 quiz.contribution.ts 中注册

// 当 Quiz 设置 schema 变更时，自动迁移旧配置到新格式
// 例如：quiz.model → quiz.defaultModel, quiz.autoApprove → quiz.permissionLevel

export function registerQuizConfigurationMigration(
  configurationService: IConfigurationService,
  storageService: IStorageService,
): void {
  const MIGRATION_KEY = 'quiz.configMigrationVersion';
  const currentVersion = 2;
  const storedVersion = storageService.getNumber(MIGRATION_KEY, StorageScope.APPLICATION, 0);

  if (storedVersion < 1) {
    // v0 → v1: quiz.model → quiz.defaultModelId
    const oldModel = configurationService.getValue<string>('quiz.model');
    if (oldModel) {
      configurationService.updateValue('quiz.defaultModelId', oldModel);
    }
  }

  if (storedVersion < 2) {
    // v1 → v2: quiz.autoApprove (boolean) → quiz.permissionLevel (enum)
    const autoApprove = configurationService.getValue<boolean>('quiz.autoApprove');
    if (autoApprove !== undefined) {
      configurationService.updateValue('quiz.permissionLevel',
        autoApprove ? 'fullAuto' : 'default');
    }
  }

  storageService.store(MIGRATION_KEY, currentVersion, StorageScope.APPLICATION, StorageTarget.MACHINE);
}
```

## 21. Language Context Provider

语言特定的上下文提供者。对标 Copilot `extension/languageContextProvider/vscode-node/languageContextProviderService.ts` (5.4KB)。

```typescript
// electron-browser/contextResolvers/quizLanguageContextProviderService.ts

export const IQuizLanguageContextProviderService = createDecorator<IQuizLanguageContextProviderService>(
  'quizLanguageContextProviderService'
);

export interface IQuizLanguageContextProviderService {
  readonly _serviceBrand: undefined;

  /**
   * 获取当前文件的语言特定上下文。
   * 不同语言提供不同类型的上下文：
   * - TypeScript: 类型定义、import 语句、接口签名
   * - Python: import 语句、类定义、函数签名
   * - Java: package 声明、import、类签名
   * - 通用: 文件结构概览
   */
  getLanguageContext(uri: URI, token: CancellationToken): Promise<IQuizLanguageContext | undefined>;
}

export interface IQuizLanguageContext {
  readonly languageId: string;
  readonly imports?: string[];          // import 语句列表
  readonly definitions?: string[];     // 关键定义（类/接口/函数签名）
  readonly structure?: string;         // 文件结构概览
  readonly typeDefinitions?: string[]; // 类型定义（TS/JS 特有）
}
```

## 22. Diagnostics Context Provider

诊断/错误上下文提供者。对标 Copilot `extension/diagnosticsContext/vscode/diagnosticsContextProvider.ts` (6.8KB)。

```typescript
// browser/contextResolvers/quizDiagnosticsContextProvider.ts

export const IQuizDiagnosticsContextProvider = createDecorator<IQuizDiagnosticsContextProvider>(
  'quizDiagnosticsContextProvider'
);

export interface IQuizDiagnosticsContextProvider {
  readonly _serviceBrand: undefined;

  /**
   * 获取当前编辑器/工作区的诊断上下文。
   * 用于：
   * - inline chat 的 "Fix this" 意图
   * - Agent 模式的自动错误检测
   * - terminal fix generator 的错误匹配
   */
  getDiagnosticsContext(
    scope: 'activeEditor' | 'workspace',
    token: CancellationToken
  ): Promise<IQuizDiagnosticsContext>;
}

export interface IQuizDiagnosticsContext {
  readonly errors: readonly IQuizDiagnostic[];
  readonly warnings: readonly IQuizDiagnostic[];
  readonly hasErrors: boolean;
}

export interface IQuizDiagnostic {
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly source: string;           // 来源（如 'ts', 'eslint', 'python'）
  readonly uri: URI;
  readonly range: { startLine: number; endLine: number };
  readonly code?: string | number;   // 诊断代码（如 'TS2322'）
  readonly relatedInformation?: readonly IQuizRelatedInfo[];
}

export interface IQuizRelatedInfo {
  readonly message: string;
  readonly uri: URI;
  readonly range: { startLine: number; endLine: number };
}
```

## 23. Blocked Extension Service

临时屏蔽滥用扩展。对标 Copilot `platform/chat/common/blockedExtensionService.ts`。

```typescript
// common/quizBlockedExtensionService.ts

export const IQuizBlockedExtensionService = createDecorator<IQuizBlockedExtensionService>(
  'quizBlockedExtensionService'
);

export interface IQuizBlockedExtensionService {
  readonly _serviceBrand: undefined;

  /**
   * 报告某个扩展正在滥用工具调用（如频繁调用导致 rate limit）
   * @param extensionId 扩展 ID
   * @param timeout 屏蔽时长（秒）
   */
  reportBlockedExtension(extensionId: string, timeout: number): void;

  /**
   * 检查某个扩展是否被临时屏蔽
   */
  isExtensionBlocked(extensionId: string): boolean;
}
```

## 24. Interaction Service

逻辑交互追踪服务。对标 Copilot `platform/chat/common/interactionService.ts`。
用于 telemetry 关联：将一组请求归为同一个"交互"。

```typescript
// common/quizInteractionService.ts

export const IQuizInteractionService = createDecorator<IQuizInteractionService>(
  'quizInteractionService'
);

export interface IQuizInteractionService {
  readonly _serviceBrand: undefined;

  /** 当前交互 ID（用于 telemetry 关联） */
  readonly interactionId: string;

  /** 开始新的交互（新会话或用户主动重置时调用） */
  startInteraction(): void;
}
```

## Reference Documents

- **Session management**: Read `references/session-management-reference.md`
- **BYOK providers**: Read `references/byok-reference.md`
- **Embeddings & search**: Read `references/embeddings-search-reference.md`
- **Checkpoint system**: Read `references/checkpoint-reference.md`
