---
name: quiz-file-blueprint
description: "Complete file blueprint for the Quiz AI assistant in VS Code Core. Lists every single file with its full path, detailed comment, owning skill, and layer classification. Use when (1) You need to know exactly what files to create and where they go, (2) You need to verify no files are missing from the implementation, (3) You need to understand which skill owns which file, (4) You need to check layer correctness (common/browser/electron-browser), (5) You are scaffolding the initial project structure, or (6) You need a single reference for the entire Quiz codebase layout."
---

# Quiz File Blueprint

Complete file listing for `src/vs/workbench/contrib/quiz/` — every file, every layer, every skill.

## Layer Rules

| Layer | Directory | Runs In | Allowed Imports | What Goes Here |
|-------|-----------|---------|-----------------|----------------|
| **common/** | `contrib/quiz/common/` | Web + Desktop | Only other common/ code | Interfaces, types, enums, pure logic, abstract classes |
| **browser/** | `contrib/quiz/browser/` | Web + Desktop | common/ + browser/ + VS Code service abstractions | UI, Web API implementations, VS Code service integrations |
| **electron-browser/** | `contrib/quiz/electron-browser/` | Desktop Only | common/ + browser/ + Node.js APIs | Node.js fs, child_process, ONNX, git, HTTP modules |

## Skill Ownership Legend

| Tag | Skill |
|-----|-------|
| `[CORE]` | quiz-vscode-core-ai — Registration, services, endpoints, parsers, auth, telemetry, context keys, settings schema |
| `[PROMPT]` | quiz-prompt-engineering — Prompt building, conversation management, intent detection, chat variables, streaming grammar, categorization |
| `[TOOLS]` | quiz-agent-tools — Individual tool implementations, schemas, confirmations, tool registry, virtual tools, tool grouping |
| `[UI]` | quiz-chat-ui — Chat panel, inline, quick, editor surfaces, branding, code blocks, linkify, getting started, inline chat |
| `[RUNTIME]` | quiz-agent-runtime — Tool calling loop, hooks, agent providers, autopilot, hook telemetry, hook output channel |
| `[SESSION]` | quiz-session-management — Transcript, checkpoints, metadata, feedback, BYOK, embeddings, search, completions, inline edits, debug, customization, conversation store, power management, onboard debug |

---

## Complete File Tree

```
src/vs/workbench/contrib/quiz/
│
╞══════════════════════════════════════════════════════════════════════════════
│ common/ — Platform-agnostic interfaces, types, enums, pure logic
╞══════════════════════════════════════════════════════════════════════════════
│
├── common/
│   │
│   ├── quizTypes.ts                        # [CORE] Core type definitions — QuizRequest, QuizResponse, QuizMode, QuizProviderKind
│   ├── quizConfiguration.ts                # [CORE] Configuration key definitions — quiz.model, quiz.mode, quiz.byok.*, quiz.embeddings.*
│   ├── quizToolIds.ts                      # [CORE] QuizToolId const enum — all 31 tool IDs (quiz_readFile, quiz_editFile, quiz_generateQuestions, etc.)
│   ├── quizLanguageModels.ts               # [CORE] Language model descriptor constants — model IDs, vendor, families, default model per mode
│   ├── quizService.ts                      # [CORE] IQuizService interface — handleRequest(), sendRequest(), cancelRequest(), getActiveSession()
│   ├── quizServiceImpl.ts                  # [CORE] Core orchestration — wires endpoint→parser→prompt→loop→transcript, manages request lifecycle
│   ├── quizAgent.ts                        # [CORE] Session registration — registers SessionType.Quiz into IChatSessionsService, creates session handler
│   ├── quizSessionItemController.ts        # [CORE] IChatSessionItemController impl — manages session list items, handles rename/delete/restore
│   ├── quizSessionHandler.ts               # [CORE] IChatSessionContentProvider impl — handles chat requests, delegates to quizServiceImpl.handleRequest()
│   ├── quizLanguageModelProvider.ts        # [CORE] ILanguageModelChatProvider impl — providesLanguageModels(), prepareLanguageModelChatCall(), handles streaming
│   ├── quizSlashCommands.ts                # [CORE] Slash command definitions — /quiz, /challenge, /review, /ask with when-clauses and argument schemas
│   ├── constants.ts                        # [CORE] SessionType.Quiz = 'quiz', VENDOR_QUIZ = 'quiz', QUIZ_CHAT_VIEW_ID, display name, icon references
│   │
│   ├── model/
│   │   └── quizSession.ts                  # [CORE] QuizSession data model — sessionId, turns[], model, mode, createdAt, tokenUsageSummary
│   │
│   ├── endpoint/
│   │   ├── quizEndpoint.ts                 # [CORE] IQuizEndpoint interface — sendRequest(), abortRequest(), getModels(), supportsStreaming
│   │   ├── quizEndpointTypes.ts            # [CORE] Request/Response types — QuizEndpointRequest, QuizEndpointResponse, QuizStreamChunk, QuizErrorType
│   │   └── quizModelRouter.ts              # [CORE] Model → endpoint routing — routes modelId to correct endpoint (Quiz cloud vs BYOK vs local)
│   │
│   ├── auth/
│   │   └── quizAuthProvider.ts             # [CORE] IQuizAuthProvider interface — getSession(), onDidChangeSession, login(), logout()
│   │
│   ├── parser/
│   │   ├── quizResponseParser.ts           # [CORE] IQuizResponseParser interface — parseStream(), parseComplete(), extractToolCalls(), extractMarkdown()
│   │   └── quizCodeParser.ts               # [CORE] IQuizCodeParser interface — parseCodeBlocks(), detectLanguage(), extractImports()
│   │
│   ├── context/
│   │   ├── workspaceContext.ts             # [CORE] IQuizWorkspaceContext interface — getWorkspaceFolders(), getOpenFiles(), getGitRepos()
│   │   ├── editorContext.ts                # [CORE] IQuizEditorContext interface — getActiveEditor(), getSelection(), getVisibleRange(), getLanguage()
│   │   ├── gitContext.ts                   # [CORE] IQuizGitContext interface — getChanges(), getBranch(), getRemotes(), getStagedFiles()
│   │   ├── diagnosticsContext.ts           # [CORE] IQuizDiagnosticsContext interface — getErrors(), getWarnings(), getFileDiagnostics()
│   │   └── quizContextProvider.ts          # [CORE] IQuizContextProvider interface — gatherContext(), prioritizeContext(), formatForPrompt()
│   │
│   ├── intents/
│   │   ├── intentTypes.ts                  # [CORE] QuizIntent enum — Ask, Edit, Agent, Challenge, Review, Explain, Debug, Refactor, Test, Document
│   │   ├── intentService.ts                # [CORE] IQuizIntentService interface — classifyIntent(), getIntentFromMode(), registerIntentHandler()
│   │   └── intentHandlers.ts               # [CORE] Intent handler registry — maps QuizIntent → handler function, handles intent→mode→tools routing
│   │
│   ├── telemetry/
│   │   └── quizTelemetry.ts                # [CORE] IQuizTelemetryService interface — reportRequest(), reportToolCall(), reportFeedback(), reportError()
│   │
│   ├── prompt/
│   │   ├── quizSystemPrompt.ts             # [PROMPT] IQuizPromptBuilder interface — buildSystemPrompt(), buildToolDescriptions(), buildContextSection(), assembleMessages()
│   │   ├── quizToolPrompts.ts              # [PROMPT] Tool prompt template data — each tool's modelDescription, usage instructions, example invocations
│   │   ├── quizConversation.ts             # [PROMPT] Conversation/Turn types — QuizConversationTurn, QuizChatMessage, QuizMessageRole, QuizContentPart
│   │   └── quizIntentDetector.ts           # [PROMPT] IQuizIntentDetector interface — detectIntent(), extractEntities(), classifyQuery()
│   │
│   ├── agentLoop/
│   │   ├── quizToolCallingLoop.ts           # [RUNTIME] THE core agent loop — abstract class with run(), buildPrompt(), getAvailableTools(), fetch(), executeToolCall()
│   │   ├── quizToolCallRound.ts             # [RUNTIME] IQuizToolCallRound, IQuizToolCall, IQuizTokenUsage — tracks rounds, results, token usage per iteration
│   │   ├── quizAutopilotManager.ts          # [RUNTIME] Autopilot mode — shouldAutopilotContinue(), ensureAutopilotTools(), task_complete enforcement, MAX_AUTOPILOT_ITERATIONS=5
│   │   └── quizLoopTypes.ts                # [RUNTIME] IQuizLoopResult, IQuizLoopFetchOptions, IQuizBuildPromptContext, IQuizBuildPromptResult, ToolCallLimitBehavior
│   │
│   ├── hooks/
│   │   ├── quizHookService.ts              # [RUNTIME] IQuizHookService interface — executeHook(), registerHookProvider(), manages hook lifecycle
│   │   ├── quizHookTypes.ts                # [RUNTIME] QuizHookType enum (SessionStart/PreToolUse/PostToolUse/Stop/SubagentStart/SubagentStop), input/output types for each hook
│   │   └── quizHookExecutor.ts             # [RUNTIME] IQuizHookExecutor interface — execute(), handles hook process spawning and result collection
│   │
│   ├── agents/
│   │   ├── quizAgentTypes.ts               # [RUNTIME] QuizAgentMode enum (Ask/Edit/Agent/Challenge/Review), IQuizAgentConfig, QuizAgentConfigs map with tools/instructions per mode
│   │   ├── quizAgentProvider.ts            # [RUNTIME] IQuizAgentProvider interface — getAgentConfig(), createToolCallingLoop(), getAvailableToolsForMode()
│   │   └── quizAgentLifecycle.ts           # [RUNTIME] QuizAgentLifecycleState enum (Idle/Starting/Running/WaitingForConfirmation/ExecutingTool/Completing/Error/Cancelled), IQuizAgentLifecycleManager
│   │
│   ├── ui/
│   │   ├── quizViewIds.ts                  # [UI] View ID constants — QUIZ_CHAT_VIEW_ID, QUIZ_SESSION_VIEW_ID, QUIZ_STATUS_BAR_ITEM_ID
│   │   ├── quizModeKind.ts                 # [UI] QuizModeKind enum — Ask=ChatModeKind.Ask, Edit=ChatModeKind.Edit, Agent=ChatModeKind.Agent, Challenge='challenge', Review='review'
│   │   └── quizUiTypes.ts                  # [UI] UI interface definitions — IQuizViewOptions, IQuizModeSelectorOptions, IQuizWelcomeOptions
│   │
│   ├── session/
│   │   ├── quizSessionTranscript.ts         # [SESSION] IQuizSessionTranscriptService interface — recordTurn(), getTranscript(), clearTranscript(); IQuizHistoricalTurn, IQuizCompactionMetadata
│   │   ├── quizChatHistoryBuilder.ts        # [SESSION] IQuizChatHistoryBuilder interface — buildMessages(), compactHistory(); IQuizHistoryBuildOptions, IQuizCompactionResult
│   │   ├── quizSessionMetadataStore.ts      # [SESSION] IQuizSessionMetadataStore interface — storeMetadata(), getMetadata(), getAllMetadata(), deleteMetadata(); IQuizSessionMetadata
│   │   └── quizSessionTypes.ts             # [SESSION] Session data types — IQuizTurnRequest, IQuizTurnResponse, IQuizTokenUsageSummary, IQuizCustomizationState
│   │
│   ├── checkpoint/
│   │   ├── quizCheckpointService.ts         # [SESSION] IQuizCheckpointService interface — createWorktree(), createCheckpoint(), restoreCheckpoint(), getCheckpoints(), disposeWorktree()
│   │   └── quizCheckpointTypes.ts          # [SESSION] Checkpoint data types — IQuizWorktreeProperties, IQuizWorktreeFile, IQuizCheckpoint (id, ref, message, timestamp, fileChanges)
│   │
│   ├── feedback/
│   │   ├── quizFeedbackService.ts          # [SESSION] IQuizFeedbackService interface — handleFeedback(), handleUserAction(), canReportIssues(), reportIssue()
│   │   └── quizFeedbackTypes.ts           # [SESSION] Feedback types — IQuizFeedback (helpful/unhelpful), IQuizUserAction (copy/insert/run/retry), IQuizIssueReport
│   │
│   ├── byok/
│   │   ├── quizByokService.ts              # [SESSION] IQuizByokService interface — registerProvider(), getProviders(), storeApiKey(), getApiKey(), removeApiKey()
│   │   ├── quizByokTypes.ts               # [SESSION] BYOK provider types — IQuizByokProvider, IQuizByokModelInfo, IQuizByokCapabilities, IQuizByokRequestOptions
│   │   ├── quizByokMessageConverter.ts     # [SESSION] Base message converter — IQuizMessageConverter interface, convertToolCalls(), convertToolResults()
│   │   ├── quizAnthropicMessageConverter.ts # [SESSION] Anthropic format converter — IQuizChatMessage[] → Anthropic Messages API format, tool_use/tool_result blocks
│   │   ├── quizGeminiMessageConverter.ts   # [SESSION] Gemini format converter — IQuizChatMessage[] → Google Gemini API format, functionCall/functionResponse parts
│   │   └── quizOpenAIMessageConverter.ts   # [SESSION] OpenAI format converter — IQuizChatMessage[] → OpenAI Chat Completions format, function/tool_call blocks
│   │
│   ├── embeddings/
│   │   ├── quizEmbeddingsComputer.ts       # [SESSION] IQuizEmbeddingsComputer interface — computeEmbeddings(), getEmbeddingDimension(); QuizEmbeddingType enum
│   │   ├── quizEmbeddingsIndex.ts          # [SESSION] IQuizEmbeddingsIndex interface — indexFile(), removeFile(), search(), getIndexStats(); IQuizSearchResult, IQuizIndexStats
│   │   ├── quizEmbeddingsGrouper.ts        # [SESSION] IQuizEmbeddingsGrouper interface — groupEmbeddings(), mergeGroups(); IQuizEmbeddingGroup (id, embeddings, centroid, label)
│   │   ├── quizEmbeddingsStorage.ts        # [SESSION] IQuizEmbeddingsStorage interface — storeEmbedding(), getEmbedding(), deleteEmbedding(), getAllEmbeddings()
│   │   └── quizRemoteEmbeddingsComputer.ts # [SESSION] IQuizRemoteEmbeddingsComputer interface — computeViaRemoteApi(), handles cloud-based embedding computation
│   │
│   ├── semanticSearch/
│   │   ├── quizSemanticSearchService.ts    # [SESSION] IQuizSemanticSearchService interface — search(), indexWorkspace(), getSearchProvider(); IQuizSemanticSearchOptions/Result
│   │   ├── quizCombinedRank.ts             # [SESSION] Combined ranking algorithm — merges BM25 keyword scores + semantic embedding scores with configurable weights
│   │   └── quizSemanticSearchTypes.ts      # [SESSION] Search result types — IQuizSearchRange, IQuizSemanticSearchResult (uri, ranges, score, snippet)
│   │
│   ├── workspaceSearch/
│   │   ├── quizWorkspaceChunkSearch.ts     # [SESSION] IQuizWorkspaceChunkSearchService interface — searchChunks(), getIndexingStatus(); IQuizChunkSearchOptions, IQuizChunkResult
│   │   └── quizWorkspaceIndexingStatus.ts  # [SESSION] IQuizIndexingStatus interface — state (idle/indexing/complete/error), progress, totalFiles, indexedFiles
│   │
│   ├── workspaceRecorder/
│   │   ├── quizWorkspaceRecorder.ts        # [SESSION] IQuizWorkspaceRecorder interface — startRecording(), stopRecording(), getRecordedChanges(), onDidChangeWorkspace
│   │   └── quizWorkspaceListenerService.ts # [SESSION] IQuizWorkspaceListenerService interface — listen(), onDidChange, manages file system watcher registration
│   │
│   ├── debug/
│   │   ├── quizDebugLogger.ts              # [SESSION] IQuizDebugLogger interface — logRequest(), logResponse(), logToolCall(), getLogEntries(), clearLog(), exportLog()
│   │   ├── quizRequestLogger.ts            # [SESSION] IQuizRequestLogger interface — createCorrelationId(), logWithCorrelation(), captureToken()
│   │   └── quizRequestCorrelation.ts       # [SESSION] Correlation ID tracking — generates unique IDs, maps correlation → request/response pairs for debugging
│   │
│   ├── customization/
│   │   ├── quizCustomizationSyncProvider.ts # [SESSION] IQuizCustomizationSyncProvider interface — getCustomizations(), pushCustomization(), pullCustomizations(); IQuizCustomizationRef
│   │   ├── quizCustomizationItemProvider.ts # [SESSION] IQuizCustomizationItemProvider interface — getItems(), onDidChangeItems; IQuizCustomizationItem (id, label, type, source)
│   │   └── quizCustomizationBundler.ts     # [SESSION] IQuizCustomizationBundler interface — bundleCustomizations(); IQuizCustomizationBundle (instructions, prompts, skills, slashCommands)
│   │
│   ├── inlineEdits/
│   │   ├── quizInlineEditService.ts        # [SESSION] IQuizInlineEditService interface — provideInlineEdits(), applyInlineEdit(), rejectInlineEdit()
│   │   └── quizInlineEditTypes.ts         # [SESSION] Inline edit types — IQuizInlineEdit (id, uri, range, newText, originalText, confidence), IQuizInlineEditContext
│   │
│   ├── completions/
│   │   ├── quizCompletionService.ts        # [SESSION] IQuizCompletionService interface — provideInlineCompletions(), handleDidShowCompletion(), handleDidAcceptCompletion()
│   │   └── quizCompletionTypes.ts         # [SESSION] Completion types — IQuizInlineCompletion (id, insertText, range, command), IQuizCompletionContext
│   │
│   ├── titleGeneration/
│   │   └── quizTitleProvider.ts            # [SESSION] IQuizTitleProvider interface — provideTitle(firstMessage, mode), auto-generates session title from first user message
│   │
│   ├── welcome/
│   │   └── quizWelcomeMessageProvider.ts   # [SESSION] IQuizWelcomeMessageProvider interface — getWelcomeMessage(), getAdditionalWelcomeContent(); IQuizWelcomeMessage, IQuizWelcomeCommand
│   │
│   ├── terminalFix/
│   │   └── quizTerminalFixGenerator.ts     # [SESSION] IQuizTerminalFixGenerator interface — generateFix(terminalOutput, command); IQuizTerminalFix (explanation, suggestedCommand, confidence)
│   │
│   ├── modelAccess/
│   │   ├── quizModelAccessService.ts       # [SESSION] IQuizModelAccessService interface — getModelCapabilities(), getConfigurationSchema(), shouldAutoDowngrade(), getAlternativeModel()
│   │   └── quizChatQuotaService.ts         # [SESSION] IQuizChatQuotaService interface — getQuotaStatus(), onDidChangeQuota, checkQuota(); IQuizQuotaStatus (remaining, total, resetDate)
│   │
│   │   # ┬───── MISSING FROM ORIGINAL 212 — Added after Copilot audit ─────┐
│   │
│   ├── toolSystem/                         # [TOOLS] Tool system infrastructure (was missing)
│   │   ├── quizToolNames.ts                # [TOOLS] Tool name registry — maps QuizToolId → human-readable name + modelReferenceName, central source of truth for tool naming
│   │   ├── quizToolsRegistry.ts            # [TOOLS] IQuizToolsRegistry interface — registerTool(), getTool(), getAllTools(), getToolsForMode(), tool discovery and lookup
│   │   ├── quizToolsService.ts             # [TOOLS] IQuizToolsService interface — getToolData(), invokeTool(), prepareToolInvocation(), orchestrates tool lifecycle
│   │   ├── quizToolSchemaNormalizer.ts     # [TOOLS] Tool schema normalizer — normalizes JSON Schema for LLM consumption, removes unsupported features, adds defaults
│   │   ├── quizToolDeferralService.ts      # [TOOLS] IQuizToolDeferralService interface — defers expensive tool loading until first use, lazy registration pattern
│   │   ├── quizToJsonSchema.ts             # [TOOLS] JSON Schema builder — converts tool parameter definitions to JSON Schema format, handles nested types and enums
│   │   ├── quizEditToolLearningService.ts   # [TOOLS] IQuizEditToolLearningService interface — learns from edit tool usage patterns, improves edit suggestions over time
│   │   ├── quizEditToolLearningStates.ts    # [TOOLS] Edit tool learning state types — IQuizEditLearningState, learning metrics, pattern tracking data structures
│   │   └── quizMemoryCleanupService.ts     # [TOOLS] IQuizMemoryCleanupService interface — cleans up old memory entries, TTL-based eviction, storage quota enforcement
│   │
│   ├── virtualTools/                       # [TOOLS] Virtual tool system (was missing — Copilot has 12 files here)
│   │   ├── quizVirtualTool.ts              # [TOOLS] IQuizVirtualTool interface — dynamically composed tool from tool groups, lazy instantiation
│   │   ├── quizVirtualToolTypes.ts         # [TOOLS] Virtual tool types — IQuizVirtualToolGroup, IQuizVirtualToolDefinition, grouping metadata
│   │   ├── quizVirtualToolGrouper.ts       # [TOOLS] IQuizVirtualToolGrouper interface — groups tools by semantic similarity using embeddings, creates virtual tool groups
│   │   ├── quizVirtualToolGroupCache.ts    # [TOOLS] Virtual tool group cache — caches grouping results, invalidates on tool set changes
│   │   ├── quizVirtualToolSummarizer.ts    # [TOOLS] Virtual tool summarizer — generates concise descriptions for tool groups for LLM consumption
│   │   ├── quizVirtualToolsConstants.ts    # [TOOLS] Virtual tool constants — max tools per group, embedding dimensions, cache TTL
│   │   ├── quizToolEmbeddingsComputer.ts   # [TOOLS] IQuizToolEmbeddingsComputer interface — computes embeddings for tool descriptions, enables semantic grouping
│   │   ├── quizToolEmbeddingsLocalCache.ts # [TOOLS] Local tool embeddings cache — caches pre-computed tool embeddings, handles version invalidation
│   │   ├── quizPreComputedToolEmbeddingsCache.ts # [TOOLS] Pre-computed cache — ships with hardcoded embeddings for built-in tools, zero startup cost
│   │   ├── quizToolGrouping.ts             # [TOOLS] Tool grouping algorithm — K-means clustering of tool embeddings, configurable group count
│   │   ├── quizToolGroupingService.ts      # [TOOLS] IQuizToolGroupingService interface — manages tool grouping lifecycle, triggers re-grouping on tool changes
│   │   └── quizBuiltInToolGroupHandler.ts  # [TOOLS] Built-in tool group handler — handles selection/execution for built-in tool groups, routes to actual tool impl
│   │
│   ├── promptExt/                          # [PROMPT] Additional prompt infrastructure (was missing)
│   │   ├── quizChatVariablesCollection.ts  # [PROMPT] Chat variable resolver — resolves #file, #selection, #terminal, #problems, #git variables in user messages
│   │   ├── quizCodeGuesser.ts              # [PROMPT] Language guesser — detects programming language from code snippets using heuristics + file extension
│   │   ├── quizFileTreeParser.ts           # [PROMPT] File tree parser — parses file tree output into structured format for prompt context inclusion
│   │   ├── quizStreamingGrammar.ts         # [PROMPT] Streaming grammar — defines grammar rules for parsing streaming LLM responses (code blocks, tool calls, thinking)
│   │   ├── quizPromptCategorization.ts     # [PROMPT] Prompt categorization — categorizes user prompts by type (question, edit, explain, debug, test, review)
│   │   ├── quizSpecialRequestTypes.ts      # [PROMPT] Special request types — retry, continuation, follow-up, clarification request type definitions
│   │   └── quizImportStatement.ts          # [PROMPT] Import statement parser — parses import statements for context extraction, language-aware
│   │
│   ├── conversation/                       # [SESSION] Conversation helpers (was missing)
│   │   ├── quizLanguageModelChatMessageHelpers.ts # [SESSION] Chat message helpers — extractText(), extractToolCalls(), mergeMessages(), utility functions for IQuizChatMessage
│   │   └── quizConversationStore.ts        # [SESSION] IQuizConversationStore interface — persistConversation(), loadConversation(), listConversations(), deleteConversation()
│   │
│   ├── sessionExt/                         # [SESSION] Additional session infrastructure (was missing)
│   │   ├── quizTtlCache.ts                 # [SESSION] TTL cache utility — generic time-to-live cache with eviction, used by transcript/metadata/embeddings
│   │   ├── quizWorkspaceInfo.ts            # [SESSION] Workspace info utility — IQuizWorkspaceInfo, getWorkspaceRoot(), getRepoInfo(), workspace metadata
│   │   ├── quizAgentSessionsWorkspace.ts   # [SESSION] IQuizAgentSessionsWorkspace interface — manages workspace-level agent session state, session→workspace mapping
│   │   ├── quizFolderRepositoryManager.ts  # [SESSION] IQuizFolderRepositoryManager interface — maps workspace folders to git repositories, handles multi-root
│   │   ├── quizChatPromptFileService.ts    # [SESSION] IQuizChatPromptFileService interface — discovers/loads .md prompt files from workspace, watches for changes
│   │   ├── quizChatCustomAgentsService.ts  # [SESSION] IQuizChatCustomAgentsService interface — registers custom agents from extensions, manages agent lifecycle
│   │   └── quizSessionRepositoryTracker.ts # [SESSION] IQuizSessionRepositoryTracker interface — tracks which repositories have active sessions, cleanup on repo close
│   │
│   ├── contextExt/                         # [CORE] Additional context infrastructure (was missing)
│   │   ├── quizContextKeys.ts              # [CORE] Context key definitions — quizAvailable, quizMode, quizModel, quizQuotaExceeded, when-clause context keys
│   │   └── quizSelectionContextHelpers.ts  # [CORE] Selection context helpers — extractSelectedCode(), getSurroundingContext(), determineIntentFromSelection()
│   │
│   ├── settingsExt/                        # [CORE] Settings schema infrastructure (was missing)
│   │   └── quizSettingsSchemaFeature.ts    # [CORE] IQuizSettingsSchemaFeature interface — generates dynamic JSON schema for quiz settings, model picker, BYOK config
│   │
│   │   # ┬───── ROUND 4 — Deep Copilot audit additions ─────┐
│   │
│   ├── linkify/                            # [UI] Linkify base infrastructure (was missing — Copilot has 8 common files)
│   │   ├── quizLinkifyService.ts           # [UI] IQuizLinkifyService interface — linkify(), registerLinkifier(), manages link detection in chat messages
│   │   ├── quizLinkifier.ts                # [UI] IQuizLinkifier abstract class — base linkifier with detectLinks(), createLink(), regex-based link detection
│   │   ├── quizFilePathLinkifier.ts        # [UI] IQuizFilePathLinkifier interface — detects file path patterns in chat, creates clickable file links
│   │   ├── quizModelFilePathLinkifier.ts   # [UI] IQuizModelFilePathLinkifier interface — detects model file references, resolves to workspace URIs
│   │   ├── quizResponseStreamLinkifier.ts  # [UI] IQuizResponseStreamLinkifier interface — linkifies streaming response text in real-time, handles chunk boundaries
│   │   ├── quizLinkifiedText.ts            # [UI] Linkified text types — IQuizLinkifiedText, IQuizLinkSpan, IQuizLinkAction, link metadata
│   │   ├── quizLinkifyCommands.ts          # [UI] Linkify command types — IQuizLinkifyCommand, link click handler type definitions
│   │   └── quizStatCache.ts               # [UI] IQuizStatCache interface — caches file existence checks for link validation, TTL-based
│   │
│   ├── byokExt/                            # [SESSION] Additional BYOK infrastructure (was missing)
│   │   ├── quizGeminiFunctionDeclarationConverter.ts # [SESSION] Gemini function declaration converter — converts tool schemas to Gemini FunctionDeclaration format
│   │   ├── quizAzureOpenAIEndpoint.ts      # [SESSION] Azure OpenAI endpoint types — deployment URL patterns, API version, authentication headers
│   │   └── quizOpenAIEndpoint.ts           # [SESSION] OpenAI endpoint types — base URL, organization header, API version, model→endpoint mapping
│   │
│   ├── intentsExt/                         # [CORE] Additional intent infrastructure (was missing)
│   │   ├── quizAgentConfig.ts              # [CORE] Agent config types — IQuizAgentConfigMap, default tool sets per intent, round limits per intent
│   │   └── quizIntentRegistry.ts           # [CORE] IQuizIntentRegistry interface — registerIntent(), getIntent(), getAllIntents(), intent discovery and lookup
│   │
│   ├── inlineEditsExt/                     # [SESSION] Additional NES common infrastructure (was missing — Copilot has 10 common files)
│   │   ├── quizEditRebase.ts              # [SESSION] Edit rebase algorithm — repositions inline edits after document changes, handles insert/delete shifts
│   │   ├── quizUserInteractionMonitor.ts   # [SESSION] IQuizUserInteractionMonitor interface — monitors user actions on inline edits, tracks accept/reject/ignore
│   │   ├── quizNearbyCursorInlineEditProvider.ts # [SESSION] IQuizNearbyCursorInlineEditProvider interface — provides edits near cursor position
│   │   ├── quizObservableWorkspaceRecordingReplayer.ts # [SESSION] IQuizObservableWorkspaceRecordingReplayer — replays recorded workspace changes as observables
│   │   ├── quizRejectionCollector.ts       # [SESSION] IQuizRejectionCollector interface — collects rejected inline edits for learning/telemetry
│   │   ├── quizInlineEditCommonTypes.ts    # [SESSION] NES common types — IQuizInlineEditState, correlation IDs, delay config, NES trigger hints
│   │   ├── quizInformationDelta.ts         # [SESSION] Information delta — computes diff between expected and actual inline edit results
│   │   └── quizImportFiltering.ts          # [SESSION] Import filtering — filters import-related inline edit suggestions by relevance
│   │
│   ├── power/                              # [SESSION] Power management (was missing — Copilot has common/powerService.ts)
│   │   └── quizPowerService.ts             # [SESSION] IQuizPowerService interface — getPowerState(), onDidChangePowerState, isOnBattery(), shouldThrottle()
│   │
│   ├── onboardDebug/                       # [SESSION] Onboard debug common (was missing — Copilot has common/launchConfigService.ts)
│   │   └── quizLaunchConfigService.ts      # [SESSION] IQuizLaunchConfigService interface — getLaunchConfig(), parseDebugConfig(), debug launch configuration types
│   │
│   ├── telemetryExt/                       # [CORE] Additional telemetry (was missing — Copilot has common/lifecycleTelemetryContrib.ts)
│   │   └── quizLifecycleTelemetry.ts       # [CORE] IQuizLifecycleTelemetry interface — reportActivation(), reportDeactivation(), session lifecycle events
│   │
│   ├── workspaceRecorderExt/               # [SESSION] Additional workspace recorder common (was missing)
│   │   └── quizJsonlUtil.ts               # [SESSION] JSONL utility — writeJsonlLine(), readJsonlStream(), newline-delimited JSON helpers for recording
│   │
│   ├── completionsExt/                     # [SESSION] Additional completions common (was missing — Copilot has 3 common files)
│   │   ├── quizCompletionConfig.ts         # [SESSION] Completion config — IQuizCompletionConfig, debounce delay, trigger characters, enable/disable flags
│   │   ├── quizInlineCompletionItemProviderService.ts # [SESSION] IQuizInlineCompletionItemProviderService interface — provides inline completion items
│   │   └── quizParseBlock.ts              # [SESSION] Parse block — parses completion response blocks, handles partial/incomplete blocks
│   │
│   ├── gettingStartedExt/                  # [UI] Additional getting started common (was missing)
│   │   └── quizNewWorkspaceContext.ts       # [UI] IQuizNewWorkspaceContext interface — workspace template types, file templates, project scaffolding options
│   │
│   ├── chatSessionsExt/                    # [SESSION] Additional chat sessions common (was missing)
│   │   ├── quizChatSessionWorkspaceFolderService.ts # [SESSION] IQuizChatSessionWorkspaceFolderService interface — getWorkspaceFolderForSession(), session→folder mapping
│   │   └── quizChatSessionUtils.ts         # [SESSION] Chat session utility functions — session ID generation, serialization helpers, date formatting
│   │
│   ├── contributions.ts                    # [CORE] Contribution registration helpers — registerContribution(), contribution metadata types, used by quiz.contribution.ts
│
╞══════════════════════════════════════════════════════════════════════════════
│ browser/ — Web + Desktop implementations (Web APIs, VS Code service abstractions)
╞══════════════════════════════════════════════════════════════════════════════
│
├── browser/
│   │
│   ├── quiz.contribution.ts                # [CORE] Main browser registration entry — registers SessionType.Quiz, session handler, LM provider, tools, views, commands via AgentHostContribution pattern
│   │
│   ├── endpoint/
│   │   ├── quizEndpointImpl.ts             # [CORE] Browser endpoint — uses fetch() for streaming, handles SSE parsing, auth header injection, content-type negotiation
│   │   ├── quizStreamingEndpoint.ts        # [CORE] SSE stream handler — reads ReadableStream, parses SSE events (data:, event:, id:), emits QuizStreamChunk
│   │   ├── quizRetryPolicy.ts              # [CORE] Exponential backoff — calculates retry delay, respects Retry-After header, max 3 retries, jitter for thundering herd
│   │   └── quizResponseConverter.ts        # [CORE] API response → QuizChunk — converts raw HTTP response to QuizTextChunk/QuizToolCallChunk/QuizThinkingChunk/QuizErrorChunk
│   │
│   ├── auth/
│   │   └── quizAuthProviderImpl.ts         # [CORE] Auth implementation — uses IAuthenticationService.getSessions('quiz'), handles OAuth flow, token refresh, session change events
│   │
│   ├── parser/
│   │   ├── quizResponseParserImpl.ts       # [CORE] Response parser — parses streaming text into markdown blocks + tool call JSON, handles cross-chunk accumulation
│   │   └── quizProgressAdapter.ts          # [CORE] QuizChunk → IChatProgress — converts internal QuizChunk types to VS Code's IChatProgress for rendering in ChatWidget
│   │
│   ├── context/
│   │   ├── workspaceContext.ts             # [CORE] Workspace context impl — uses IWorkspaceContextService, gets open editors, workspace folders, recent files
│   │   ├── editorContext.ts                # [CORE] Editor context impl — uses ICodeEditorService, gets active editor, selection, visible range, language, unsaved changes
│   │   ├── gitContext.ts                   # [CORE] Git context impl — uses IGitService, gets branch, changes, staged files, remotes, recent commits
│   │   ├── diagnosticsContext.ts           # [CORE] Diagnostics context impl — uses IMarkerService, gets errors/warnings for active file and project
│   │   └── quizContextProvider.ts          # [CORE] Context provider impl — gathers all contexts, applies priority ranking, formats for prompt inclusion, respects token budget
│   │
│   ├── telemetry/
│   │   └── quizTelemetryServiceImpl.ts     # [CORE] Telemetry impl — uses ITelemetryService, sends quiz/request, quiz/toolCall, quiz/feedback, quiz/error events with PII redaction
│   │
│   ├── prompt/
│   │   ├── quizSystemPromptBuilder.ts      # [PROMPT] System prompt builder — assembles system prompt from mode instructions + tool descriptions + context + customization instructions
│   │   ├── quizToolPromptAssembler.ts      # [PROMPT] Tool prompt assembler — builds tool usage instructions, formats tool schemas for model consumption, orders by relevance
│   │   ├── quizConversationManager.ts      # [PROMPT] Conversation manager — manages conversation history, applies compaction when exceeding token limit, handles isContinuation
│   │   ├── quizIntentDetectorImpl.ts       # [PROMPT] Intent detector impl — classifies user query into QuizIntent using heuristics + model-based classification, extracts entities
│   │   └── quizFeedbackGenerator.ts        # [PROMPT] Feedback generator — generates user-facing feedback messages, progress updates, error explanations, quiz hints
│   │
│   ├── tools/
│   │   ├── quizToolsContribution.ts        # [TOOLS] Browser tools registration — registers all 11 browser-safe tools with ILanguageModelToolsService.$registerToolData()
│   │   ├── generateQuestionsTool.ts         # [TOOLS] Generate quiz questions — creates multiple-choice/coding/fill-blank questions from code/docs, supports difficulty levels
│   │   ├── evaluateAnswerTool.ts           # [TOOLS] Evaluate user answer — checks correctness, provides explanation, tracks score, adjusts difficulty for spaced repetition
│   │   ├── trackProgressTool.ts            # [TOOLS] Track learning progress — records quiz results, calculates mastery level, schedules review sessions via SM-2 algorithm
│   │   ├── searchKnowledgeBaseTool.ts      # [TOOLS] Search knowledge base — queries Quiz KB via browser-safe API, returns relevant concepts/explanations/examples
│   │   ├── getErrorsTool.ts                # [TOOLS] Get diagnostics — uses IMarkerService to retrieve errors/warnings for specified file or project, no confirmation needed
│   │   ├── searchWorkspaceSymbolsTool.ts   # [TOOLS] Search symbols — uses IWorkspaceSymbolService to find symbols by name/type, returns symbol kind + location
│   │   ├── manageTodoListTool.ts           # [TOOLS] Manage todo list — creates/updates/deletes todo items, reuses Core's ManageTodoListTool pattern
│   │   ├── askQuestionsTool.ts             # [TOOLS] Ask questions — interactive clarification questions to user, reuses Core's AskQuestionsTool pattern
│   │   ├── confirmationTool.ts             # [TOOLS] Yes/No confirmation — asks user for explicit approval before proceeding, reuses Core's ConfirmationTool pattern
│   │   └── switchAgentTool.ts              # [TOOLS] Switch agent mode — switches between Ask/Challenge/Review modes mid-conversation, updates available tool set
│   │
│   ├── agentLoop/
│   │   └── quizToolCallingLoopImpl.ts      # [RUNTIME] Concrete loop implementation — extends QuizToolCallingLoop, implements buildPrompt() using prompt builders, fetch() via endpoint
│   │
│   ├── hooks/
│   │   ├── quizHookServiceImpl.ts          # [RUNTIME] Hook service impl — manages hook providers, executes hooks via IQuizHookExecutor, collects results, handles errors
│   │   └── quizHookResultProcessor.ts      # [RUNTIME] Hook result processor — processHookResults() function, routes success/error outputs, formats blocking reasons for model
│   │
│   ├── agents/
│   │   ├── quizAskAgentProvider.ts         # [RUNTIME] Ask mode agent — Q&A only, no file edits, 5 tool call rounds max, tools: askQuestions + searchSymbols + getErrors + readFile
│   │   ├── quizEditAgentProvider.ts        # [RUNTIME] Edit mode agent — code editing, 10 rounds max, tools: readFile + editFile + applyPatch + createFile + search
│   │   ├── quizAgentModeAgentProvider.ts   # [RUNTIME] Agent mode — full autonomous, 30 rounds max, ALL tools available, supports autopilot with task_complete
│   │   ├── quizChallengeAgentProvider.ts   # [RUNTIME] Challenge mode — generates quiz questions, evaluates answers, tracks progress, adapts difficulty, 15 rounds max
│   │   └── quizReviewAgentProvider.ts      # [RUNTIME] Review mode — reviews code + creates quiz questions about codebase, 10 rounds max, tools: readFile + getErrors + askQuestions
│   │
│   ├── media/
│   │   └── quiz.css                        # [UI] Brand styles — .quiz-theme CSS variables (--quiz-primary, --quiz-accent), chat bubble styles, mode selector styles
│   │
│   ├── quizAgentView.ts                    # [UI] Chat panel ViewPane — extends ChatViewPane, provides Quiz welcome message, mode selector (Ask/Challenge/Review), Quiz toolbar actions
│   ├── quizWidget.ts                       # [UI] ChatWidget configuration — configures Core's ChatWidget with Quiz brand options, binds Quiz agent, sets mode options, placeholder text
│   ├── quizInputPart.ts                    # [UI] Input configuration — configures ChatInputPart with "Ask Quiz..." placeholder, Quiz tool picker buttons, attachment type config
│   ├── quizInlineWidget.ts                 # [UI] Inline chat widget — adapts Core's inlineChat for Quiz, shows Quiz branding in inline chat header
│   ├── quizQuickChat.ts                    # [UI] Quick chat floating panel — configures Core's quick chat for Quiz, floating panel with Quiz branding
│   ├── quizEditorChat.ts                   # [UI] Editor chat — configures editor-integrated chat surface for Quiz, shows Quiz responses inline in editor
│   ├── quizEditingWidget.ts                # [UI] Keep/Undo editing — adapts Core's chatEditing system, connects Quiz agent's edit results to editing session, Quiz button text
│   ├── quizStatusBar.ts                    # [UI] Status bar icon — shows Quiz connection status (connected/disconnected/error), current model info, click opens Chat panel
│   │
│   ├── actions/
│   │   └── quizActions.ts                  # [UI] Commands + keybindings — quiz.openChat (Ctrl+Alt+I), quiz.toggleMode, quiz.newSession, quiz.reportIssue, quiz.openSettings
│   │
│   ├── session/
│   │   ├── quizSessionTranscriptImpl.ts    # [SESSION] Transcript impl (browser) — stores transcript in memory + IndexedDB, handles compaction, manages turn recording
│   │   ├── quizChatHistoryBuilderImpl.ts   # [SESSION] History builder impl — converts IQuizSessionTranscript → IQuizChatMessage[], handles format-specific conversion (openai/anthropic/gemini)
│   │   ├── quizSessionMetadataStoreImpl.ts # [SESSION] Metadata store impl (IndexedDB) — persists session metadata in browser IndexedDB, handles storage quota
│   │   ├── quizFeedbackServiceImpl.ts      # [SESSION] Feedback impl — handles 👍👎 feedback via IChatService.notifyUserAction(), issue reporting via GitHub issue template
│   │   ├── quizTitleProviderImpl.ts        # [SESSION] Title provider impl — sends first message to LLM with title-generation prompt, caches title in metadata store
│   │   ├── quizWelcomeMessageProviderImpl.ts # [SESSION] Welcome message impl — returns Quiz-branded welcome with title, description, commands (/quiz, /challenge), tips
│   │   ├── quizTerminalFixGeneratorImpl.ts # [SESSION] Terminal fix impl — sends terminal error output to LLM, parses suggested fix, returns IQuizTerminalFix
│   │   ├── quizModelAccessServiceImpl.ts   # [SESSION] Model access impl — queries model capabilities from endpoint, builds configuration schema for model picker (thinking effort)
│   │   ├── quizChatQuotaServiceImpl.ts     # [SESSION] Quota tracking impl — polls quota status from endpoint, fires onDidChangeQuota, shows quota exceeded notification
│   │   └── quizDebugLoggerImpl.ts         # [SESSION] Debug logger impl (browser) — stores log entries in memory, exports as JSON, shows in output channel
│   │
│   ├── customization/
│   │   ├── quizCustomizationSyncProviderImpl.ts   # [SESSION] Customization sync impl — integrates with ICustomizationHarnessService, pushes/pulls customizations
│   │   ├── quizCustomizationItemProviderImpl.ts   # [SESSION] Customization item provider impl — lists available customizations (instructions, prompts, skills, slash commands)
│   │   └── quizCustomizationBundlerImpl.ts        # [SESSION] Customization bundler impl — combines user + workspace + builtIn customizations into single bundle for prompt
│   │
│   ├── byok/
│   │   ├── quizByokContribution.ts         # [SESSION] BYOK registration — registers BYOK providers as language model vendors, contributes commands and settings UI
│   │   └── quizByokStorageService.ts       # [SESSION] Key storage — uses VS Code SecretStorage API to securely store API keys per provider
│   │
│   ├── embeddings/
│   │   ├── quizRemoteEmbeddingsComputerImpl.ts # [SESSION] Remote embeddings impl — calls cloud embedding API via fetch(), handles batching and rate limiting
│   │   └── quizEmbeddingsStorageImpl.ts    # [SESSION] Embeddings storage impl — stores embeddings in IndexedDB, handles eviction policy, version migration
│   │
│   ├── semanticSearch/
│   │   └── quizSemanticSearchServiceImpl.ts # [SESSION] Semantic search impl (browser) — uses remote embeddings for search, delegates to cloud API
│   │
│   ├── workspaceSearch/
│   │   └── quizWorkspaceSearchCommands.ts   # [SESSION] Search command registration — registers workspace search commands in command palette, shows indexing status
│   │
│   └── inlineEdits/
│       ├── quizInlineEditServiceImpl.ts    # [SESSION] Inline edit service impl — requests edits from LLM, renders inline edit suggestions with accept/reject
│       └── quizInlineEditWidget.ts         # [SESSION] Inline edit widget — renders edit suggestion as inline decoration with accept/reject/modify controls
│   │
│   │   # ┬───── MISSING FROM ORIGINAL 212 — Added after Copilot audit ─────┐
│   │
│   ├── contextKeys/
│   │   └── quizContextKeys.contribution.ts  # [CORE] Context key contribution — registers quizAvailable, quizMode, quizModel when-clause context keys for menu/toolbar visibility
│   │
│   ├── settingsSchema/
│   │   └── quizSettingsSchemaFeatureImpl.ts # [CORE] Settings schema impl — generates dynamic JSON schema for quiz.* settings, model picker enum, BYOK provider list
│   │
│   ├── conversation/
│   │   ├── quizChatParticipants.ts         # [CORE] Chat participant registration — registers Quiz as IChatParticipant, handles suggest/trigger, displayName, description
│   │   ├── quizConversationFeature.ts      # [CORE] Conversation feature registration — registers all Quiz features (tools, modes, slash commands, context providers)
│   │   ├── quizUserActions.ts              # [SESSION] User action tracking — tracks copy/insert/run/retry actions on Quiz responses, sends telemetry, enables undo
│   │   ├── quizNewWorkspaceFollowup.ts      # [SESSION] New workspace follow-up — suggests follow-up actions after workspace creation from Quiz conversation
│   │   └── quizAiMappedEditsContrib.ts     # [SESSION] AI mapped edits contribution — registers Quiz as AI edit provider for mapped edit scenarios
│   │
│   ├── codeBlocks/
│   │   ├── quizCodeBlockLanguageFeatures.ts # [UI] Code block language features — adds syntax highlighting, go-to-definition, copy actions to code blocks in Quiz responses
│   │   └── quizCodeBlockProvider.ts         # [UI] Code block provider — extracts code blocks from Quiz responses, provides language detection and formatting
│   │
│   ├── linkify/
│   │   ├── quizLinkifyCommands.ts          # [UI] Linkify commands — handles clicks on symbol/file links in Quiz chat messages, navigates to definition
│   │   ├── quizFindSymbol.ts               # [UI] Find symbol — resolves symbol references in chat messages to workspace locations via IWorkspaceSymbolService
│   │   ├── quizFindWord.ts                 # [UI] Find word — resolves word references in chat messages to file locations via text search
│   │   ├── quizInlineCodeSymbolLinkifier.ts # [UI] Inline code symbol linkifier — detects `code` references in chat and creates clickable links
│   │   ├── quizNotebookCellLinkifier.ts    # [UI] Notebook cell linkifier — detects notebook cell references and creates clickable links
│   │   └── quizSymbolLinkifier.ts          # [UI] Symbol linkifier — detects symbol names in chat and creates clickable links using language features
│   │
│   ├── gettingStarted/
│   │   ├── quizGettingStartedCommands.ts   # [UI] Getting started commands — opens Quiz walkthrough, first-run experience
│   │   ├── quizNewWorkspace.contribution.ts # [UI] New workspace contribution — registers Quiz workspace creation template
│   │   └── quizNewWorkspaceInitializer.ts  # [UI] New workspace initializer — initializes workspace with Quiz-recommended structure
│   │
│   ├── inlineChat/
│   │   ├── quizInlineChatCodeActions.ts    # [UI] Inline chat code actions — adds "Ask Quiz" code action lightbulb in editor
│   │   ├── quizInlineChatCommands.ts       # [UI] Inline chat commands — startInlineChat, accept/reject/cancel inline chat, keyboard shortcuts
│   │   ├── quizInlineChatNotebookActions.ts # [UI] Inline chat notebook actions — adds "Ask Quiz" action in notebook cells
│   │   └── quizNaturalLanguageHint.ts      # [UI] Natural language hint — shows ghost text hint for inline chat trigger in editor
│   │
│   ├── chatSessionContext/
│   │   └── quizChatSessionContextProvider.ts # [SESSION] Session context provider — provides chat session context (model, mode, tools, history) for prompt building
│   │
│   ├── promptFileContext/
│   │   └── quizPromptFileContextProvider.ts # [SESSION] Prompt file context — resolves .md prompt file references in chat input, loads content for prompt
│   │
│   ├── debug/
│   │   ├── quizChatDebugFileLoggerService.ts # [SESSION] Debug file logger (52KB in Copilot) — detailed request/response logging to output channel, supports export
│   │   ├── quizChatHookTelemetry.ts        # [RUNTIME] Hook telemetry — sends telemetry events for hook execution (duration, result, errors), performance tracking
│   │   └── quizHooksOutputChannel.ts       # [RUNTIME] Hooks output channel — creates VS Code output channel for hook execution results, real-time display
│   │
│   ├── quota/
│   │   └── quizQuota.contribution.ts       # [SESSION] Quota contribution — registers quota status bar item, quota exceeded notification, quota reset command
│   │
│   ├── power/
│   │   └── quizPowerStateLogger.ts         # [SESSION] Power state logger — logs system power state changes (battery/sleep), adjusts Quiz behavior for power saving
│   │
│   │   # ┬───── ROUND 4 — Deep Copilot audit additions (browser) ─────┐
│   │
│   ├── conversationExt/                    # [SESSION] Additional conversation browser files (was missing)
│   │   ├── quizLanguageModelAccess.ts      # [SESSION] Model access — queries model capabilities, permission checks, model selection logic (37KB in Copilot)
│   │   ├── quizFeedbackCollection.ts       # [SESSION] Feedback collection — collects 👍👎 feedback, sends to telemetry, handles feedback UI
│   │   ├── quizFeedbackReporter.ts         # [SESSION] Feedback reporter — creates issue reports from feedback, opens GitHub issue template
│   │   ├── quizFeedbackContribution.ts     # [SESSION] Feedback contribution — registers feedback commands and UI contributions
│   │   ├── quizLogWorkspaceState.ts        # [SESSION] Workspace state logger — logs workspace state for debugging, captures open editors and workspace info
│   │   ├── quizResolveModelId.ts           # [SESSION] Model ID resolver — resolves model display names to internal model IDs, handles aliases
│   │   └── quizRemoteAgents.ts             # [SESSION] Remote agents — discovers and registers remote agent participants from extensions
│   │
│   ├── contextExt/                         # [CORE] Additional context browser files (was missing)
│   │   ├── quizContext.contribution.ts     # [CORE] Context contribution — registers context providers, wires context resolvers to chat system
│   │   ├── quizDiagnosticsContextProviderService.ts # [SESSION] Diagnostics context — provides error/warning context for inline chat "Fix this" and agent auto-detection
│   │   └── quizLanguageContextProviderService.ts # [SESSION] Language context — provides language-specific context (TS types, Python imports, Java packages)
│   │
│   ├── promptExt/                         # [PROMPT] Additional prompt browser files (was missing)
│   │   ├── quizEndpointProviderImpl.ts     # [PROMPT] Endpoint provider impl — provides model endpoint URLs, handles model→endpoint routing in browser
│   │   ├── quizPromptVariablesService.ts   # [PROMPT] Prompt variables service — resolves prompt variable references (#file, #selection) in browser context
│   │   └── quizDevContainerConfigurationServiceImpl.ts # [PROMPT] Dev container config service impl — generates devcontainer.json from workspace analysis
│   │
│   ├── search/                            # [SESSION] Search commands (was missing)
│   │   └── quizSearchCommands.ts           # [SESSION] Search commands — registers workspace search commands in command palette
│   │
│   ├── log/                               # [SESSION] Log viewer (was missing — Copilot has 4 vscode-node files)
│   │   ├── quizExtensionStateCommand.ts    # [SESSION] Extension state command — shows extension state for debugging, command palette entry
│   │   ├── quizLoggingActions.ts           # [SESSION] Logging actions — clear log, export log, show log, filter log commands
│   │   └── quizRequestLogTree.ts           # [SESSION] Request log tree — tree view provider for request/response log entries, hierarchical display
│   │
│   ├── inlineEditsExt/                    # [SESSION] Additional NES browser files (was missing — Copilot has extensive vscode-node NES)
│   │   ├── quizIsInlineSuggestion.ts      # [SESSION] Inline suggestion check — determines if a text change is an inline edit suggestion
│   │   ├── quizRaceAndAll.ts              # [SESSION] Race/all utility — races multiple inline edit providers, returns first result or all results
│   │   ├── quizInlineEditParts/           # [SESSION] NES parts subdirectory
│   │   │   ├── quizInlineEditPartCommon.ts # [SESSION] Part common types — shared types for inline edit UI parts
│   │   │   ├── quizDocumentFilter.ts      # [SESSION] Document filter — filters which documents are eligible for inline edits
│   │   │   ├── quizInlineEditLogger.ts    # [SESSION] Inline edit logger — logs inline edit events for debugging
│   │   │   ├── quizVerifyTextDocumentChanges.ts # [SESSION] Verify changes — verifies text document changes before applying
│   │   │   └── quizVscodeWorkspace.ts     # [SESSION] VS Code workspace — workspace integration for inline edit lifecycle, file operations
│   │   ├── quizInlineEditUtils/           # [SESSION] NES utils subdirectory
│   │   │   ├── quizObservablesUtils.ts    # [SESSION] Observables utils — RxJS utility functions for inline edit event streams
│   │   │   ├── quizTranslations.ts        # [SESSION] Translations — translates inline edit data between internal and VS Code formats
│   │   │   └── quizVirtualTextDocumentProvider.ts # [SESSION] Virtual text doc — provides virtual text documents for inline edit preview
│   │   ├── quizInlineEditFeatures/        # [SESSION] NES features subdirectory
│   │   │   ├── quizDiagnosticsCompletionProcessor.ts # [SESSION] Diagnostics completion — generates inline edit suggestions from diagnostic errors
│   │   │   ├── quizDiagnosticsInlineEditProvider.ts # [SESSION] Diagnostics provider — provides inline edits specifically for fixing diagnostics
│   │   │   └── quizDiagnosticsBasedCompletions/ # [SESSION] Diagnostics-based completions subdirectory
│   │   │       ├── quizAnyDiagnosticsCompletionProvider.ts # [SESSION] Any diagnostics provider — provides completions for any diagnostic type
│   │   │       ├── quizAsyncDiagnosticsCompletionProvider.ts # [SESSION] Async diagnostics — provides completions for async diagnostic results
│   │   │       ├── quizDiagnosticsCompletions.ts # [SESSION] Diagnostics completions — core logic for diagnostic-based completion generation
│   │   │       └── quizImportDiagnosticsCompletionProvider.ts # [SESSION] Import diagnostics — provides completions specifically for import errors
│   │   ├── quizInlineEditComponents/      # [SESSION] NES components subdirectory
│   │   │   ├── quizExpectedEditCaptureController.ts # [SESSION] Expected edit capture — captures expected edits for learning and telemetry
│   │   │   ├── quizInlineEditDebugComponent.ts # [SESSION] Debug component — debug overlay showing edit confidence, model, timing
│   │   │   ├── quizLogContextRecorder.ts   # [SESSION] Log context recorder — records edit context for debugging and improvement
│   │   │   └── quizNesFeedbackSubmitter.ts # [SESSION] NES feedback — submits inline edit feedback for model improvement
│   │   └── quizSimilarFilesContext.ts      # [SESSION] Similar files context — finds similar files for inline edit context enrichment
│   │
│   ├── completionsExt/                    # [SESSION] Additional completions browser files (was missing)
│   │   ├── quizCompletionsCoreContribution.ts # [SESSION] Core contribution — registers inline completion provider with VS Code
│   │   ├── quizCompletionsUnificationContribution.ts # [SESSION] Unification contribution — unifies Quiz completions with Copilot completions
│   │   └── quizCopilotInlineCompletionItemProviderService.ts # [SESSION] Inline completion provider — provides inline completion items to VS Code
│
╞══════════════════════════════════════════════════════════════════════════════
│ electron-browser/ — Desktop-only implementations (Node.js APIs: fs, child_process, ONNX, git)
╞══════════════════════════════════════════════════════════════════════════════
│
├── electron-browser/
│   │
│   ├── quiz.electron.contribution.ts       # [CORE] Electron contribution entry — registers native tools, checkpoint service, native endpoint, lifecycle handler, imports from workbench.desktop.main.ts
│   ├── quizLifecycleHandler.ts             # [CORE] Lifecycle handler — handles shutdown (saves transcript), background throttling suspension, command-line --quiz argument
│   │
│   ├── endpoint/
│   │   ├── quizNativeEndpoint.ts           # [CORE] Native endpoint — uses Node.js http/https for streaming, handles proxy settings, certificate validation, connection pooling
│   │   └── quizNativeResponseConverter.ts  # [CORE] Native response converter — converts Node.js http.IncomingMessage to QuizChunk, handles chunked transfer encoding
│   │
│   ├── auth/
│   │   └── quizNativeAuthProvider.ts       # [CORE] Native auth — uses keytar/secretstorage for token persistence, handles system keychain integration
│   │
│   ├── parser/
│   │   └── quizNativeCodeParser.ts         # [CORE] Native AST parser — uses Node.js tree-sitter for code structure analysis, faster than regex-based browser parser
│   │
│   ├── tools/
│   │   ├── nativeQuizToolsContribution.ts  # [TOOLS] Native tools registration — registers all 20 Node.js tools with ILanguageModelToolsService.$registerToolData()
│   │   ├── readFileTool.ts                 # [TOOLS] Read file — uses Node.js fs.readFile, 2000-line chunks, offset/limit params, confirmation for external paths
│   │   ├── listDirTool.ts                  # [TOOLS] List directory — uses Node.js fs.readdir with recursive option, returns file tree with types and sizes
│   │   ├── editFileTool.ts                 # [TOOLS] Edit file — applies line-based edits or unified diff patches, uses IFileService for workspace files, confirmation required
│   │   ├── createFileTool.ts               # [TOOLS] Create file — creates new file with content, uses IFileService, confirmation required, handles existing file
│   │   ├── createDirectoryTool.ts          # [TOOLS] Create directory — creates directory recursively, uses IFileService, confirmation required
│   │   ├── findFilesTool.ts                # [TOOLS] Find files — uses Node.js glob (vscode.workspace.findFiles), supports include/exclude patterns, maxResults
│   │   ├── findTextInFilesTool.ts          # [TOOLS] Find text — uses ripgrep via vscode.workspace.findTextInFiles, supports regex, include/exclude, context lines
│   │   ├── terminalTool.ts                 # [TOOLS] Terminal execution — runs command in VS Code terminal, captures output, handles exit code, confirmation required
│   │   ├── notebookTool.ts                 # [TOOLS] Notebook operations — edit notebook cells, add/remove cells, change cell type, uses INotebookService
│   │   ├── applyPatchTool.ts               # [TOOLS] Apply patch — applies unified diff patches, handles hunks, conflict detection, confirmation required
│   │   ├── getScmChangesTool.ts            # [TOOLS] Get SCM changes — uses IGitService to get modified/staged/unstaged files, returns diff summary
│   │   ├── fetchWebPageTool.ts             # [TOOLS] Fetch web page — uses Node.js http/https to fetch URL content, handles HTML→markdown conversion, confirmation for external URLs
│   │   ├── viewImageTool.ts                # [TOOLS] View image — reads image file, returns as base64 data URL for model vision, supports png/jpg/gif/webp/svg
│   │   ├── codebaseSearchTool.ts           # [TOOLS] Codebase search — combines embeddings + ripgrep for hybrid search, returns ranked code snippets with context
│   │   ├── testFailureTool.ts              # [TOOLS] Test failure analysis — reads test output, parses stack traces, identifies failing test + error message
│   │   ├── installExtensionTool.ts         # [TOOLS] Install extension — installs VS Code extension from marketplace, uses IExtensionManagementService, confirmation required
│   │   ├── runVscodeCommandTool.ts          # [TOOLS] Run VS Code command — executes VS Code command via ICommandService, captures result, confirmation for destructive commands
│   │   ├── memoryTool.ts                   # [TOOLS] Persistent memory — stores/retrieves key-value pairs across sessions, uses IStorageService for persistence
│   │   ├── searchSubagentTool.ts           # [TOOLS] Search subagent — spawns a fast codebase search subagent, returns top-K relevant code snippets
│   │   └── executionSubagentTool.ts        # [TOOLS] Execution subagent — spawns a subagent loop for complex multi-step tasks, confirmation required
│   │
│   ├── prompt/
│   │   ├── quizNativePromptRenderer.ts     # [PROMPT] Native prompt renderer — reads prompt template files from disk via Node.js fs, caches in memory, faster than browser fetch
│   │   └── quizNativeTokenizer.ts          # [PROMPT] Native tokenizer — uses Node.js tiktoken for accurate token counting, enables precise context window management
│   │
│   ├── agentLoop/
│   │   └── quizNativeToolCallingLoop.ts     # [RUNTIME] Native tool calling loop — optimized for Node.js, direct fs/git access in tool execution, bypasses service abstraction for speed
│   │
│   ├── hooks/
│   │   ├── quizNativeHookServiceImpl.ts    # [RUNTIME] Native hook service — executes hooks via Node.js child_process.spawn, captures stdout/stderr, handles exit codes
│   │   └── quizShellHookExecutor.ts        # [RUNTIME] Shell hook executor — spawns shell commands for hooks, handles timeout, redacts sensitive input keys, reports results
│   │
│   ├── agents/
│   │   └── quizNativeAgentProvider.ts      # [RUNTIME] Native agent provider — creates native tool calling loop with direct Node.js tool access, optimized for desktop
│   │
│   ├── ui/
│   │   ├── quizNativeStatusBar.ts          # [UI] Native status bar — OS-level status bar integration, shows Quiz icon in system tray on supported platforms
│   │   ├── quizNativeNotifications.ts      # [UI] Native notifications — OS-level notification integration for quiz results, session completion, quota warnings
│   │   └── quizDesktopShortcuts.ts         # [UI] Desktop shortcuts — registers global keyboard shortcuts at OS level for quick Quiz access
│   │
│   ├── session/
│   │   ├── quizNativeSessionTranscriptImpl.ts  # [SESSION] File-based transcript — stores transcript as JSON on disk via Node.js fs, supports crash recovery
│   │   ├── quizNativeSessionMetadataStoreImpl.ts # [SESSION] File-based metadata — persists session metadata as JSON files, handles atomic writes, migration between versions
│   │   └── quizNativeRequestLoggerImpl.ts  # [SESSION] File-based request logger — writes request/response logs to disk, supports log rotation, exports as HAR format
│   │
│   ├── checkpoint/
│   │   ├── quizCheckpointServiceImpl.ts    # [SESSION] Git worktree checkpoint service — creates git worktree per session, auto-commits before edits, supports undo/redo via git reset (38KB)
│   │   └── quizExternalEditTrackerImpl.ts  # [SESSION] External edit tracker — tracks file modifications made outside the agent (user edits), reconciles with checkpoint state
│   │
│   ├── confirmation/
│   │   └── quizExternalPathConfirmation.ts # [SESSION] External path confirmation — prompts user when tools access files outside workspace, remembers approvals, reuses Core pattern
│   │
│   ├── byok/
│   │   ├── quizAbstractLanguageModelChatProvider.ts # [SESSION] Base LM chat provider — abstract class with common streaming/parsing logic for all BYOK providers
│   │   ├── quizByokServiceImpl.ts           # [SESSION] BYOK service impl — manages provider registration, routes requests to correct provider, handles failover
│   │   ├── quizByokModelInfo.ts            # [SESSION] BYOK model info — static model metadata (max tokens, capabilities) per provider, updated from remote model lists
│   │   ├── quizAnthropicProvider.ts         # [SESSION] Anthropic provider — implements Anthropic Messages API, handles tool_use/tool_result, thinking blocks, streaming (39KB)
│   │   ├── quizAzureProvider.ts             # [SESSION] Azure OpenAI provider — implements Azure OpenAI chat completions API, handles deployment-based routing
│   │   ├── quizCustomOAIProvider.ts         # [SESSION] Custom OpenAI provider — implements any OpenAI-compatible API, configurable endpoint URL, supports custom auth headers
│   │   ├── quizGeminiNativeProvider.ts      # [SESSION] Gemini provider — implements Google Gemini generateContent API, handles functionCall parts, safety settings (26KB)
│   │   ├── quizOllamaProvider.ts            # [SESSION] Ollama provider — implements Ollama chat API, auto-discovers local models, handles model loading, streaming
│   │   ├── quizOpenAIProvider.ts            # [SESSION] OpenAI provider — implements OpenAI Chat Completions API, handles function_call/tool_call, streaming, vision
│   │   ├── quizOpenRouterProvider.ts        # [SESSION] OpenRouter provider — implements OpenRouter API, routes to multiple model providers, handles provider-specific errors
│   │   └── quizXAIProvider.ts              # [SESSION] xAI/Grok provider — implements xAI chat API, handles Grok-specific features, streaming
│   │
│   ├── embeddings/
│   │   ├── quizNativeEmbeddingsComputerImpl.ts # [SESSION] ONNX embeddings — uses Node.js ONNX runtime for local embedding computation, no API key needed, privacy-first
│   │   ├── quizEmbeddingsComputerImpl.ts    # [SESSION] Local embeddings computation — orchestrates embedding computation pipeline, handles batching, caching
│   │   ├── quizEmbeddingsIndexImpl.ts       # [SESSION] HNSW index — implements Hierarchical Navigable Small World graph for fast approximate nearest neighbor search
│   │   ├── quizEmbeddingsGrouperImpl.ts     # [SESSION] Grouping impl — clusters embeddings by semantic similarity using K-means, generates group labels
│   │   └── quizVscodeIndexImpl.ts           # [SESSION] VS Code workspace index — indexes all workspace files, watches for changes, maintains incremental index updates
│   │
│   ├── semanticSearch/
│   │   └── quizSemanticSearchTextSearchProvider.ts # [SESSION] Native text search provider — implements ITextSearchProvider for semantic search integration with VS Code search
│   │
│   ├── workspaceSearch/
│   │   ├── quizWorkspaceChunkSearchImpl.ts  # [SESSION] Chunk search impl — splits files into overlapping chunks, indexes chunks for fast retrieval, uses Node.js fs
│   │   └── quizWorkspaceIndexingStatusImpl.ts # [SESSION] Indexing status impl — tracks indexing progress, shows progress notification, handles cancellation
│   │
│   ├── workspaceRecorder/
│   │   ├── quizWorkspaceRecorderImpl.ts     # [SESSION] Workspace recorder impl — records file changes using Node.js fs.watch, maintains change log for context
│   │   ├── quizListenerServiceImpl.ts       # [SESSION] Listener service impl — manages multiple file system watchers, handles recursive watching, debounces rapid changes
│   │   ├── quizSafeFileWriteUtils.ts        # [SESSION] Atomic file writes — uses Node.js fs to write temp file + rename for atomic writes, prevents data corruption
│   │   └── quizUtilsObservable.ts           # [SESSION] Observable utils — RxJS-based observable wrappers for file system events, handles backpressure and error recovery
│   │
│   └── completions/
│       ├── quizNativeCompletionServiceImpl.ts # [SESSION] Native completion engine — uses Node.js for fast file reading + context assembly, supports prefix/suffix matching
│       └── quizCompletionServiceImpl.ts    # [SESSION] Completion service impl — manages inline completion requests, caches results, handles telemetry
│   │
│   │   # ┬───── MISSING FROM ORIGINAL 212 — Added after Copilot audit ─────┐
│   │
│   ├── contextResolvers/
│   │   ├── quizExtensionApiContext.ts       # [CORE] Extension API context resolver — resolves extension API context for inline chat suggestions
│   │   ├── quizFixSelectionContext.ts       # [CORE] Fix selection context — resolves selection context for "fix this" inline chat intent
│   │   ├── quizGenericInlineIntentContext.ts # [CORE] Generic inline intent context — resolves context for generic inline chat invocations
│   │   ├── quizGenericPanelIntentContext.ts # [CORE] Generic panel intent context — resolves context for generic panel chat invocations
│   │   ├── quizInlineChatSelectionContext.ts # [CORE] Inline chat selection — resolves selected code + surrounding context for inline chat
│   │   ├── quizInlineFixIntentContext.ts    # [CORE] Inline fix intent context — resolves context for inline fix (error at cursor) intent
│   │   ├── quizPromptWorkspaceLabelsContext.ts # [CORE] Workspace labels context — resolves workspace folder names, file counts, language distribution for prompts
│   │   ├── quizVscodeContext.ts             # [CORE] VS Code context resolver — resolves VS Code-specific context (version, extensions, settings)
│   │   └── quizSelectionContextHelpersImpl.ts # [CORE] Selection context helpers impl — Node.js implementation of selection context extraction
│   │
│   ├── inlineEdits/
│   │   ├── quizInlineCompletionProvider.ts  # [SESSION] Inline completion provider — provides inline edit completions, handles caching and deduplication
│   │   ├── quizInlineEditModel.ts           # [SESSION] Inline edit model — data model for inline edit state (pending/accepted/rejected)
│   │   ├── quizInlineEditProviderFeature.ts # [SESSION] Inline edit provider feature — registers Quiz as inline edit provider, manages edit lifecycle
│   │   ├── quizInlineEditTriggerer.ts       # [SESSION] Inline edit triggerer — triggers inline edit suggestions based on diagnostics, idle time, explicit invocation
│   │   ├── quizDiagnosticsCompletionProcessor.ts # [SESSION] Diagnostics completion processor — generates inline edit suggestions from diagnostic errors
│   │   ├── quizDiagnosticsInlineEditProvider.ts # [SESSION] Diagnostics inline edit provider — provides inline edits specifically for fixing diagnostics
│   │   ├── quizDiagnosticsBasedCompletions/ # [SESSION] Diagnostics-based completions subdirectory
│   │   │   └── (4 files)                    # [SESSION] Detailed diagnostic-based completion logic
│   │   ├── quizExpectedEditCaptureController.ts # [SESSION] Expected edit capture — captures expected edits for learning and telemetry
│   │   ├── quizInlineEditDebugComponent.ts  # [SESSION] Inline edit debug — debug overlay showing edit confidence, model, timing
│   │   ├── quizLogContextRecorder.ts        # [SESSION] Log context recorder — records edit context for debugging and improvement
│   │   ├── quizNesFeedbackSubmitter.ts      # [SESSION] NES feedback submitter — submits inline edit feedback for model improvement
│   │   ├── quizSimilarFilesContext.ts       # [SESSION] Similar files context — finds similar files for inline edit context enrichment
│   │   └── quizJointInlineCompletionProvider.ts # [SESSION] Joint inline completion — combines multiple inline edit sources, deduplicates
│   │
│   ├── renameSuggestions/
│   │   └── quizRenameSuggestionsProvider.ts # [SESSION] Rename suggestions — AI-powered rename suggestions using LLM, integrates with VS Code rename
│   │
│   ├── promptExt/
│   │   ├── quizGitDiffService.ts            # [PROMPT] Git diff service — generates git diff for prompt context, handles staged/unstaged/committed diffs
│   │   ├── quizWorkspaceEditRecorder.ts     # [PROMPT] Workspace edit recorder — records workspace edits for undo/redo, tracks edit history per session
│   │   ├── quizIndentationGuesser.ts        # [PROMPT] Indentation guesser — detects indentation style (tabs/spaces, width) from file content for edit generation
│   │   ├── quizRequestLoggerToolResult.ts   # [SESSION] Request logger tool result — formats tool call results for debug logging, handles large output truncation
│   │   └── quizDevContainerConfigGenerator.ts # [PROMPT] Dev container config generator — generates devcontainer.json from workspace analysis
│   │
│   ├── sessionExt/
│   │   ├── quizFolderRepositoryManagerImpl.ts # [SESSION] Folder repository manager impl — maps workspace folders to git repos using Node.js git operations
│   │   ├── quizChatPromptFileServiceImpl.ts # [SESSION] Prompt file service impl — discovers .md prompt files from disk, watches for file changes
│   │   ├── quizChatCustomAgentsServiceImpl.ts # [SESSION] Custom agents service impl — loads custom agent definitions from extensions and workspace config
│   │   ├── quizSessionRepositoryTrackerImpl.ts # [SESSION] Session repository tracker impl — tracks active sessions per repository, cleanup on repo close
│   │   ├── quizAgentSessionsWorkspaceImpl.ts # [SESSION] Agent sessions workspace impl — persists workspace-level session state, handles multi-root
│   │   └── quizConversationStoreImpl.ts    # [SESSION] Conversation store impl — persists conversations to disk as JSON, handles version migration
│   │
│   ├── toolSystem/
│   │   ├── quizToolsRegistryImpl.ts         # [TOOLS] Tools registry impl — concrete tool registration, lookup, mode-based filtering
│   │   ├── quizToolsServiceImpl.ts          # [TOOLS] Tools service impl — orchestrates tool invocation, handles confirmation flow, error recovery
│   │   ├── quizToolSchemaNormalizerImpl.ts  # [TOOLS] Schema normalizer impl — normalizes tool schemas for each BYOK provider's format requirements
│   │   ├── quizEditToolLearningServiceImpl.ts # [TOOLS] Edit tool learning impl — learns from edit patterns using Node.js file analysis, stores learning state
│   │   ├── quizMemoryCleanupServiceImpl.ts  # [TOOLS] Memory cleanup impl — cleans up memory entries using Node.js cron, enforces storage limits
│   │   └── quizToolDeferralServiceImpl.ts   # [TOOLS] Tool deferral impl — defers tool registration until first use, lazy-loads tool implementations
│   │
│   ├── virtualTools/
│   │   ├── quizVirtualToolGrouperImpl.ts    # [TOOLS] Virtual tool grouper impl — groups tools using ONNX embeddings + K-means, creates virtual tool groups
│   │   ├── quizVirtualToolGroupCacheImpl.ts # [TOOLS] Virtual tool group cache impl — caches grouping results in IndexedDB + file, invalidates on changes
│   │   ├── quizVirtualToolSummarizerImpl.ts # [TOOLS] Virtual tool summarizer impl — generates concise group descriptions using LLM summarization
│   │   ├── quizToolEmbeddingsComputerImpl.ts # [TOOLS] Tool embeddings impl — computes tool description embeddings using ONNX, batches for efficiency
│   │   └── quizBuiltInToolGroupHandlerImpl.ts # [TOOLS] Built-in tool group handler impl — handles virtual tool group selection and execution routing
│   │
│   ├── onboardDebug/
│   │   ├── quizDebugCommandContribution.ts  # [SESSION] Debug command contribution — registers Quiz debug commands (export logs, show debug panel)
│   │   ├── quizDebugCommandHandle.ts        # [SESSION] Debug command handle — handles debug command execution, opens debug view
│   │   └── quizDebugCommandSession.ts       # [SESSION] Debug command session — manages debug session lifecycle, captures debug events
│   │
│   ├── power/
│   │   └── quizPowerServiceImpl.ts          # [SESSION] Power service impl — monitors system power state via Node.js, throttles Quiz on battery
│   │
│   │   # ┬───── ROUND 4 — Deep Copilot audit additions (electron-browser) ─────┐
│   │
│   ├── promptNode/                          # [PROMPT] Prompt node-layer implementations (was missing — Copilot has 16+ prompt/node/ files)
│   │   ├── quizChatMLFetcher.ts             # [PROMPT] THE core fetcher — builds LLM request from prompt, sends to endpoint, handles streaming response (90KB in Copilot)
│   │   ├── quizChatMLFetcherTelemetry.ts    # [PROMPT] Fetcher telemetry — tracks request latency, token usage, model routing, error rates
│   │   ├── quizChatParticipantRequestHandler.ts # [PROMPT] Chat participant request handler — processes chat requests, delegates to intent handlers
│   │   ├── quizChatParticipantTelemetry.ts  # [PROMPT] Chat participant telemetry — tracks participant invocation, response quality, user satisfaction
│   │   ├── quizDefaultIntentRequestHandler.ts # [PROMPT] Default intent request handler — handles requests that don't match any specific intent
│   │   ├── quizStreamingEdits.ts            # [PROMPT] Streaming edits — processes streaming edit responses, applies incremental changes
│   │   ├── quizIntentDetectorImpl.ts        # [PROMPT] Intent detector node impl — model-based intent classification using Node.js tokenizer (28KB in Copilot)
│   │   ├── quizFeedbackGeneratorImpl.ts     # [PROMPT] Feedback generator node impl — generates user-facing feedback using LLM (25KB in Copilot)
│   │   ├── quizPromptCategorizer.ts         # [PROMPT] Prompt categorizer — categorizes prompts by complexity/type for routing decisions (18KB in Copilot)
│   │   ├── quizCodebaseToolCalling.ts       # [PROMPT] Codebase tool calling — tool calling loop specialized for codebase search operations
│   │   ├── quizSearchSubagentToolCallingLoop.ts # [PROMPT] Search subagent loop — fast codebase search subagent with limited tool set
│   │   ├── quizExecutionSubagentToolCallingLoop.ts # [PROMPT] Execution subagent loop — execution subagent for complex multi-step tasks
│   │   ├── quizIntentRegistryImpl.ts        # [PROMPT] Intent registry impl — registers and looks up intent handlers, manages intent→handler mapping
│   │   ├── quizPromptVariablesServiceImpl.ts # [PROMPT] Prompt variables service impl — resolves prompt variables using Node.js file access
│   │   ├── quizDocumentContext.ts           # [PROMPT] Document context — gathers document-specific context for prompt building
│   │   ├── quizEditGeneration.ts            # [PROMPT] Edit generation — generates code edits from LLM responses, handles diff/patch creation
│   │   ├── quizEditFromDiff.ts              # [PROMPT] Edit from diff — creates edits from unified diff format, handles hunk application
│   │   ├── quizSummarizer.ts                # [PROMPT] Summarizer — summarizes conversation history for compaction, extracts key points
│   │   ├── quizTitleProviderImpl.ts         # [PROMPT] Title provider node impl — generates session titles using LLM with Node.js tokenizer
│   │   ├── quizRepoInfoTelemetry.ts         # [PROMPT] Repo info telemetry — collects repository metadata for prompt context and telemetry
│   │   ├── quizChatLogExport.ts             # [PROMPT] Chat log export — exports chat logs as JSON/HAR for debugging, uses Node.js fs
│   │   ├── quizPromptOverride.ts            # [PROMPT] Prompt override — handles custom prompt overrides from extensions and settings
│   │   ├── quizCacheBreakpoints.ts          # [PROMPT] Cache breakpoints — manages prompt caching breakpoints for token efficiency
│   │   └── quizRequestLoggerImpl.ts         # [SESSION] Request logger node impl — detailed request/response logging to output channel (31KB in Copilot)
│   │
│   ├── intentsNode/                         # [RUNTIME] Intent node-layer implementations (was missing — Copilot has 15+ intents/node/ files)
│   │   ├── quizAgentIntent.ts              # [RUNTIME] Agent intent — main intent dispatcher, routes to sub-intents, manages agent lifecycle (52KB in Copilot)
│   │   ├── quizEditCodeIntent.ts           # [RUNTIME] Edit code intent — handles code editing requests, manages edit tool calling (37KB in Copilot)
│   │   ├── quizEditCodeStep.ts             # [RUNTIME] Edit code step — single step in edit code intent, handles one edit operation
│   │   ├── quizAskAgentIntent.ts           # [RUNTIME] Ask agent intent — handles Q&A-only requests, no file edits, limited tool set
│   │   ├── quizReviewIntent.ts             # [RUNTIME] Review intent — handles code review requests, generates review feedback
│   │   ├── quizExplainIntent.ts            # [RUNTIME] Explain intent — handles code explanation requests, generates documentation
│   │   ├── quizFixIntent.ts                # [RUNTIME] Fix intent — handles fix/debug requests, diagnoses and fixes errors
│   │   ├── quizSearchIntent.ts             # [RUNTIME] Search intent — handles search requests, performs codebase search
│   │   ├── quizTerminalIntent.ts           # [RUNTIME] Terminal intent — handles terminal command requests, generates and runs commands
│   │   ├── quizVscodeIntent.ts             # [RUNTIME] VS Code intent — handles VS Code-specific requests (settings, extensions, config)
│   │   ├── quizNewNotebookIntent.ts         # [RUNTIME] New notebook intent — handles notebook creation requests, generates notebook content
│   │   ├── quizNotebookEditorIntent.ts     # [RUNTIME] Notebook editor intent — handles notebook editing requests, modifies cells
│   │   ├── quizAllIntents.ts               # [RUNTIME] All intents registry — registers all intent handlers, provides intent lookup
│   │   ├── quizIntentServiceImpl.ts        # [RUNTIME] Intent service impl — orchestrates intent classification and handler dispatch
│   │   └── quizFixTestFailureContributions.ts # [RUNTIME] Fix test failure contributions — registers fix-test-failure commands and context
│   │
│   ├── toolsNode/                           # [TOOLS] Tool node-layer helper files (was missing — Copilot has 10+ tools/node/ helper files)
│   │   ├── quizToolUtils.ts                # [TOOLS] Tool utilities — common helper functions for tool implementations (15KB in Copilot)
│   │   ├── quizEditFileHealing.tsx          # [TOOLS] Edit file healing — auto-heals malformed edits, fixes indentation/whitespace (21KB in Copilot)
│   │   ├── quizEditFileToolUtils.tsx        # [TOOLS] Edit file tool utilities — line matching, hunk parsing, conflict detection (35KB in Copilot)
│   │   ├── quizEditFileToolResult.tsx       # [TOOLS] Edit file tool result — formats edit results, handles success/partial/failure (9KB in Copilot)
│   │   ├── quizAbstractReplaceStringTool.tsx # [TOOLS] Abstract replace string — base class for string replacement tools (31KB in Copilot)
│   │   ├── quizFindTestsFilesTool.tsx       # [TOOLS] Find tests files — discovers test files in workspace, supports multiple test frameworks (12KB in Copilot)
│   │   ├── quizMemoryContextPrompt.tsx       # [TOOLS] Memory context prompt — builds prompt section from memory tool data (16KB in Copilot)
│   │   ├── quizTodoListContextPrompt.tsx     # [TOOLS] Todo list context prompt — builds prompt section from todo list state
│   │   ├── quizToolSearchTool.ts            # [TOOLS] Tool search — searches available tools by name/capability for tool discovery
│   │   ├── quizVscodeAPITool.ts             # [TOOLS] VS Code API tool — exposes VS Code API operations as tool
│   │   ├── quizReadProjectStructureTool.ts  # [TOOLS] Read project structure — reads and formats project directory structure
│   │   ├── quizImageToolUtils.ts            # [TOOLS] Image tool utilities — image loading, resizing, base64 encoding helpers
│   │   ├── quizInsertEditTool.tsx           # [TOOLS] Insert edit tool — inserts new content at specified position
│   │   ├── quizMultiReplaceStringTool.tsx   # [TOOLS] Multi-replace string — performs multiple string replacements in one operation
│   │   ├── quizReplaceStringTool.tsx        # [TOOLS] Replace string — replaces a single string occurrence in a file
│   │   ├── quizNewNotebookTool.tsx          # [TOOLS] New notebook tool — creates new Jupyter notebook with specified cells
│   │   ├── quizNotebookSummaryTool.tsx      # [TOOLS] Notebook summary — summarizes notebook content and cell outputs
│   │   ├── quizGetNotebookCellOutputTool.ts # [TOOLS] Get notebook cell output — retrieves cell execution output
│   │   ├── quizGetSearchViewResultsTool.ts  # [TOOLS] Get search results — retrieves results from VS Code search view
│   │   ├── quizGithubRepoTool.tsx           # [TOOLS] GitHub repo tool — accesses GitHub repository information
│   │   ├── quizResolveMemoryFileUriTool.ts  # [TOOLS] Resolve memory file URI — resolves memory:// URIs to actual file paths
│   │   ├── quizRunNotebookCellTool.tsx      # [TOOLS] Run notebook cell — executes a notebook cell and captures output
│   │   └── quizEditNotebookTool.tsx         # [TOOLS] Edit notebook — edits notebook cell content, adds/removes cells
│   │
│   ├── byokExt/                             # [SESSION] Additional BYOK node implementations (was missing)
│   │   ├── quizAzureOpenAIEndpointImpl.ts   # [SESSION] Azure OpenAI endpoint impl — Node.js HTTP client for Azure OpenAI, deployment-based routing
│   │   ├── quizOpenAIEndpointImpl.ts        # [SESSION] OpenAI endpoint impl — Node.js HTTP client for OpenAI, organization header support (12KB in Copilot)
│   │   └── quizGeminiFunctionDeclarationConverterImpl.ts # [SESSION] Gemini function declaration converter impl — converts tool schemas to Gemini format
│   │
│   ├── inlineEditsNode/                     # [SESSION] NES node-layer implementations (was missing — Copilot has 10+ node/ NES files)
│   │   ├── quizNextEditProvider.ts          # [SESSION] Next Edit Suggestion provider — core NES logic, predicts and provides edits (65KB in Copilot)
│   │   ├── quizNextEditProviderTelemetry.ts # [SESSION] NES telemetry — tracks NES suggestion quality, acceptance rate, latency (58KB in Copilot)
│   │   ├── quizNextEditCache.ts             # [SESSION] NES cache — caches previous edit suggestions for fast re-display (13KB in Copilot)
│   │   ├── quizDebugRecorder.ts             # [SESSION] NES debug recorder — records NES events for debugging and improvement (7KB in Copilot)
│   │   ├── quizEditRebaseImpl.ts            # [SESSION] Edit rebase impl — repositions edits after document changes using Node.js text diff
│   │   ├── quizUserInteractionMonitorImpl.ts # [SESSION] User interaction monitor impl — monitors user actions on NES suggestions
│   │   ├── quizNearbyCursorInlineEditProviderImpl.ts # [SESSION] Nearby cursor provider impl — provides NES near cursor using Node.js file access
│   │   ├── quizRejectionCollectorImpl.ts    # [SESSION] Rejection collector impl — collects rejected NES for learning
│   │   ├── quizObservableWorkspaceRecordingReplayerImpl.ts # [SESSION] Recording replayer impl — replays workspace changes as observables
│   │   └── quizImportFilteringImpl.ts       # [SESSION] Import filtering impl — filters import NES by relevance using Node.js analysis
│   │
│   ├── renameSuggestionsExt/                # [SESSION] Additional rename suggestions (was missing)
│   │   └── quizRenameSuggestionsPrompt.tsx  # [SESSION] Rename suggestions prompt — builds LLM prompt for rename suggestions
│   │
│   ├── onboardDebugExt/                    # [SESSION] Additional onboard debug node files (was missing — Copilot has 6 node/ files)
│   │   ├── quizDebugCommandFactory.ts       # [SESSION] Debug command factory — creates debug commands dynamically
│   │   ├── quizDebugConfigConverter.ts      # [SESSION] Debug config converter — converts debug configurations between formats
│   │   ├── quizDebugLaunchConfigHandler.ts  # [SESSION] Debug launch config handler — handles debug launch configuration
│   │   ├── quizDebugSessionManager.ts       # [SESSION] Debug session manager — manages debug session lifecycle
│   │   ├── quizDebugStateTracker.ts         # [SESSION] Debug state tracker — tracks debug state changes
│   │   └── quizDebugTelemetryReporter.ts   # [SESSION] Debug telemetry reporter — reports debug events to telemetry
│   │
│   ├── workspaceRecorderExt/               # [SESSION] Additional workspace recorder node files (was missing)
│   │   ├── quizWorkspaceRecorderFeature.ts  # [SESSION] Workspace recorder feature — registers workspace recorder contribution
│   │   └── quizJsonlUtilImpl.ts            # [SESSION] JSONL util impl — Node.js implementation of JSONL read/write with streams
│   │
│   ├── workspaceSearchExt/                 # [SESSION] Additional workspace search node files (was missing)
│   │   └── quizWorkspaceChunkSearch.contribution.ts # [SESSION] Chunk search contribution — registers workspace chunk search contribution
│   │
│   ├── chatSessionsExt/                    # [SESSION] Additional chat sessions node files (was missing)
│   │   ├── quizChatSessionWorkspaceFolderServiceImpl.ts # [SESSION] Workspace folder service impl — manages session→workspace folder mapping
│   │   ├── quizAskUserQuestionHandler.ts    # [SESSION] Ask user question handler — handles interactive questions to user during chat
│   │   ├── quizChatSessionsUriHandler.ts    # [SESSION] URI handler — handles quiz:// URIs for chat session deep links
│   │   └── quizChatSessions.ts             # [SESSION] Chat sessions main — manages chat session list, handles create/delete/restore (26KB in Copilot)
│   │
│   ├── contextExt/                         # [CORE] Additional context node files (was missing)
│   │   └── quizContext.contribution.ts      # [CORE] Context contribution node — registers context providers for desktop
│
╞══════════════════════════════════════════════════════════════════════════════
│ test/ — Test files
╞══════════════════════════════════════════════════════════════════════════════
│
└── test/
    ├── common/
    │   ├── quizService.test.ts              # [CORE] IQuizService unit tests — handleRequest lifecycle, error handling, cancellation
    │   ├── quizToolCallingLoop.test.ts      # [RUNTIME] Tool calling loop tests — loop iterations, tool call limits, autopilot, hooks, error recovery
    │   ├── quizPromptBuilder.test.ts        # [PROMPT] Prompt builder tests — system prompt assembly, context window management, compaction
    │   ├── quizIntentDetector.test.ts       # [PROMPT] Intent detection tests — classification accuracy, entity extraction, mode mapping
    │   ├── quizSessionTranscript.test.ts    # [SESSION] Transcript tests — turn recording, compaction, history building, format conversion
    │   ├── quizCheckpointService.test.ts    # [SESSION] Checkpoint tests — worktree creation, checkpoint save/restore, undo/redo, external edit tracking
    │   ├── quizByokProviders.test.ts        # [SESSION] BYOK provider tests — Anthropic/Gemini/OpenAI format conversion, streaming, error handling
    │   ├── quizEmbeddings.test.ts           # [SESSION] Embeddings tests — computation, indexing, search, grouping, storage
    │   └── quizFeedback.test.ts             # [SESSION] Feedback tests — helpful/unhelpful, user actions, issue reporting
    │
    └── browser/
        ├── quizEndpoint.test.ts             # [CORE] Endpoint tests — streaming, retry, auth, error handling
        ├── quizResponseParser.test.ts       # [CORE] Parser tests — markdown parsing, tool call extraction, cross-chunk accumulation
        ├── quizWidget.test.ts               # [UI] Widget tests — view registration, mode switching, branding
        ├── quizToolsContribution.test.ts     # [TOOLS] Tool registration tests — browser tools registered correctly, schemas valid
        └── quizInlineEdit.test.ts           # [SESSION] Inline edit tests — edit suggestion rendering, accept/reject
```

## File Count Summary

### Original 212 files

| Layer | Skill | Files |
|-------|-------|-------|
| **common/** | [CORE] | 22 |
| **common/** | [PROMPT] | 4 |
| **common/** | [RUNTIME] | 10 |
| **common/** | [UI] | 3 |
| **common/** | [SESSION] | 32 |
| **common/ total** | | **71** |
| **browser/** | [CORE] | 12 |
| **browser/** | [PROMPT] | 5 |
| **browser/** | [TOOLS] | 11 |
| **browser/** | [RUNTIME] | 8 |
| **browser/** | [UI] | 13 |
| **browser/** | [SESSION] | 18 |
| **browser/ total** | | **67** |
| **electron-browser/** | [CORE] | 6 |
| **electron-browser/** | [TOOLS] | 21 |
| **electron-browser/** | [PROMPT] | 2 |
| **electron-browser/** | [RUNTIME] | 4 |
| **electron-browser/** | [UI] | 3 |
| **electron-browser/** | [SESSION] | 28 |
| **electron-browser/ total** | | **64** |
| **test/** | | 10 |
| | **Original Total** | **212** |

### Missing files added after Copilot audit

| Layer | Category | Files | Copilot Source |
|-------|----------|-------|---------------|
| **common/** | toolSystem/ | 9 | tools/common/ (9 files) |
| **common/** | virtualTools/ | 12 | tools/common/virtualTools/ (12 files) |
| **common/** | promptExt/ | 7 | prompt/common/ (7 files) |
| **common/** | conversation/ | 2 | conversation/common/ (1) + conversationStore/ (1) |
| **common/** | sessionExt/ | 7 | chatSessions/common/ (7 files) |
| **common/** | contextExt/ | 2 | contextKeys/ + context/resolvers/ |
| **common/** | settingsExt/ | 1 | settingsSchema/ |
| **common/ added** | | **40** | |
| **browser/** | contextKeys/ | 1 | contextKeys/vscode-node/ |
| **browser/** | settingsSchema/ | 1 | settingsSchema/vscode-node/ |
| **browser/** | conversation/ | 5 | conversation/vscode-node/ (5 files) |
| **browser/** | codeBlocks/ | 2 | codeBlocks/vscode-node/ (2 files) |
| **browser/** | linkify/ | 6 | linkify/vscode-node/ (6 files) |
| **browser/** | gettingStarted/ | 3 | getting-started/vscode-node/ (3 files) |
| **browser/** | inlineChat/ | 4 | inlineChat/vscode-node/ (4 files) |
| **browser/** | chatSessionContext/ | 1 | chatSessionContext/vscode-node/ |
| **browser/** | promptFileContext/ | 1 | promptFileContext/ |
| **browser/** | debug/ | 3 | chat/vscode-node/ (3 files) |
| **browser/** | quota/ | 1 | chat/vscode-node/ |
| **browser/** | power/ | 1 | power/ |
| **browser/ added** | | **28** | |
| **electron-browser/** | contextResolvers/ | 9 | context/node/resolvers/ (9 files) |
| **electron-browser/** | inlineEdits/ | 13 | inlineEdits/vscode-node/ (13+ files) |
| **electron-browser/** | renameSuggestions/ | 1 | renameSuggestions/ |
| **electron-browser/** | promptExt/ | 5 | prompt/vscode-node/ (5 files) |
| **electron-browser/** | sessionExt/ | 6 | chatSessions/vscode-node/ (6 files) |
| **electron-browser/** | toolSystem/ | 6 | tools/common/ impls |
| **electron-browser/** | virtualTools/ | 5 | tools/common/virtualTools/ impls |
| **electron-browser/** | onboardDebug/ | 3 | onboardDebug/vscode-node/ (3 files) |
| **electron-browser/** | power/ | 1 | power/vscode-node/ |
| **electron-browser/ added** | | **49** | |
| **test/ added** | | 5 | |
| | **Total Added** | **122** | |

### Final Total: 212 + 122 = **334 files**

### 第三轮深度审计新增文件（Round 3 — 2025-05 深度对比 Copilot + Core）

| # | File | Layer | Skill | Comment |
|---|------|-------|-------|---------|
| 335 | `common/agentLoop/quizThinkingData.ts` | common | quiz-agent-runtime | Thinking/reasoning data — IQuizThinkingData, QuizThinkingDataItem, delta 累积, 加密思考块 |
| 336 | `common/agentLoop/quizSpecialRequestTypes.ts` | common | quiz-agent-runtime | 特殊确认流程 — tool call limit 扩展, continue-on-error, rate-limit auto-switch |
| 337 | `common/agentLoop/quizTurnStatus.ts` | common | quiz-agent-runtime | TurnStatus 完整枚举 + TurnMessage 类型 + RequestDebugInformation |
| 338 | `common/agents/quizChatPermissionService.ts` | common | quiz-agent-runtime | 工具自动审批/权限系统 — QuizPermissionLevel, QuizToolPermissionCategory, QuizToolPermissionMap |
| 339 | `common/parser/quizStreamingGrammar.ts` | common | quiz-vscode-core-ai | 流式响应状态机 — 检测 tool_call 边界, 代码块转换, thinking 块 |
| 340 | `browser/quizChatModes.contribution.ts` | browser | quiz-vscode-core-ai | 通过 IChatModeService 注册 5 种 Quiz 模式 |
| 341 | `browser/quizSessionHandler.ts` | browser | quiz-vscode-core-ai | IChatSession 实现 — requestHandler 绑定 quizService.handleRequest() |
| 342 | `browser/quizStateToProgressAdapter.ts` | browser | quiz-vscode-core-ai | Agent 内部状态 → IChatProgress[] 转换（UI 渲染桥梁） |
| 343 | `browser/quizDebugIntegration.ts` | browser | quiz-vscode-core-ai | 集成 Core 的 IChatDebugService（非独立 debug file logger） |
| 344 | `common/tools/quizToolResultCompressor.ts` | common | quiz-agent-tools | 工具结果压缩 — 截断, 保留关键行, top-K 搜索结果 |
| 345 | `electron-browser/confirmation/quizUrlFetchingConfirmation.ts` | electron-browser | quiz-agent-tools | URL 抓取确认 — 自动批准 localhost/github, 其他需确认 |
| 346 | `common/prompt/quizThinkingPromptHandler.ts` | common | quiz-prompt-engineering | Prompt 中 thinking tokens 处理 — enableThinking, reasoningEffort, compaction 优先级 |
| 347 | `common/prompt/quizPromptCategorizationTaxonomy.ts` | common | quiz-prompt-engineering | 意图分类法深度版 — 15 意图 + Quiz 特有 4 意图 + 意图→模式映射 |
| 348 | `browser/quizConfigurationMigration.ts` | browser | quiz-session-management | 设置版本迁移 — quiz.model→quiz.defaultModelId, quiz.autoApprove→quiz.permissionLevel |
| 349 | `electron-browser/contextResolvers/quizLanguageContextProviderService.ts` | electron-browser | quiz-session-management | 语言特定上下文 — TS 类型定义, Python import, Java package |
| 350 | `browser/contextResolvers/quizDiagnosticsContextProviderService.ts` | browser | quiz-session-management | 诊断/错误上下文 — inline chat "Fix this", Agent 自动错误检测 |
| 351 | `common/quizBlockedExtensionService.ts` | common | quiz-session-management | 临时屏蔽滥用扩展 — rate limit 防护 |
| 352 | `common/quizInteractionService.ts` | common | quiz-session-management | 逻辑交互追踪 — telemetry 关联, 将请求组归为同一交互 |
| 353 | `browser/contextKeys/quizContextKeys.contribution.ts` | browser | quiz-chat-ui | Quiz context keys 完整列表 — 25+ keys 用于菜单/工具栏/命令可见性 |

| | **Round 3 Added** | **19** | |

### Grand Total: 334 + 19 = **353 files**

### 第四轮深度审计新增文件（Round 4 — 2025-05 完整 Copilot 文件对比补齐）

| Layer | Category | Files | Copilot Source |
|-------|----------|-------|---------------|
| **common/** | linkify/ | 8 | linkify/common/ (8 files) |
| **common/** | byokExt/ | 3 | byok/common/ (3 files) |
| **common/** | intentsExt/ | 2 | intents/common/ (2 files) |
| **common/** | inlineEditsExt/ | 8 | inlineEdits/common/ (8 files) |
| **common/** | power/ | 1 | power/common/ (1 file) |
| **common/** | onboardDebug/ | 1 | onboardDebug/common/ (1 file) |
| **common/** | telemetryExt/ | 1 | telemetry/common/ (1 file) |
| **common/** | workspaceRecorderExt/ | 1 | workspaceRecorder/common/ (1 file) |
| **common/** | completionsExt/ | 3 | completions/common/ (3 files) |
| **common/** | gettingStartedExt/ | 1 | getting-started/common/ (1 file) |
| **common/** | chatSessionsExt/ | 2 | chatSessions/common/ (2 files) |
| **common/** | contributions.ts | 1 | common/contributions.ts |
| **common/ Round 4 added** | | **32** | |
| **browser/** | conversationExt/ | 7 | conversation/vscode-node/ (7 files) |
| **browser/** | contextExt/ | 3 | context/vscode/ + diagnosticsContext/ + languageContext/ |
| **browser/** | promptExt/ | 3 | prompt/vscode-node/ (3 files) |
| **browser/** | search/ | 1 | search/vscode-node/ |
| **browser/** | log/ | 3 | log/vscode-node/ (3 files) |
| **browser/** | inlineEditsExt/ | 22 | inlineEdits/vscode-node/ (parts+utils+features+components) |
| **browser/** | completionsExt/ | 3 | completions/vscode-node/ (3 files) |
| **browser/ Round 4 added** | | **42** | |
| **electron-browser/** | promptNode/ | 23 | prompt/node/ (16 files) + requestLogger (1) + additional prompt impls (6) |
| **electron-browser/** | intentsNode/ | 15 | intents/node/ (15 files) |
| **electron-browser/** | toolsNode/ | 22 | tools/node/ (22 files) |
| **electron-browser/** | byokExt/ | 3 | byok/node/ (3 files) |
| **electron-browser/** | inlineEditsNode/ | 10 | inlineEdits/node/ (10 files) |
| **electron-browser/** | renameSuggestionsExt/ | 1 | renameSuggestions/node/ (1 file) |
| **electron-browser/** | onboardDebugExt/ | 6 | onboardDebug/node/ (6 files) |
| **electron-browser/** | workspaceRecorderExt/ | 2 | workspaceRecorder/vscode-node/ (2 files) |
| **electron-browser/** | workspaceSearchExt/ | 1 | workspaceChunkSearch/vscode-node/ (1 file) |
| **electron-browser/** | chatSessionsExt/ | 4 | chatSessions/vscode-node/ (4 files) |
| **electron-browser/** | contextExt/ | 1 | context/vscode/ (1 file) |
| **electron-browser/ Round 4 added** | | **88** | |
| | **Round 4 Total Added** | **162** | |

### Grand Total: 353 + 162 = **515 files**

### 累计文件统计（All Rounds Combined）

| Layer | [CORE] | [PROMPT] | [TOOLS] | [RUNTIME] | [UI] | [SESSION] | Total |
|-------|--------|----------|---------|-----------|------|-----------|-------|
| **common/** | 25 | 7 | 21 | 13 | 12 | 67 | **145** |
| **browser/** | 16 | 9 | 11 | 8 | 22 | 55 | **121** |
| **electron-browser/** | 8 | 28 | 43 | 19 | 3 | 64 | **165** |
| **test/** | | | | | | | **15** |
| **Layer Total** | **49** | **44** | **75** | **40** | **37** | **186** | **515** |

> 注：Round 2 新增的 [TOOLS] common/ 文件（toolSystem 9 + virtualTools 12 = 21）大幅提升了 common/[TOOLS] 数量。
> Round 4 新增的 promptNode(23) + intentsNode(15) + toolsNode(22) 主要集中在 electron-browser/ 层。

## Layer Correctness Verification

### 三层分层规则验证

| 规则 | 验证结果 | 说明 |
|------|---------|------|
| **common/ 只含接口/类型/纯逻辑** | ✅ 通过 | 所有 common/ 文件为 interface、type、enum、abstract class、纯函数 |
| **common/ 不引用 browser/ 或 electron-browser/** | ✅ 通过 | common/ 只导入其他 common/ 代码 |
| **browser/ 可引用 common/ + browser/** | ✅ 通过 | browser/ 使用 VS Code service abstractions (IWorkspaceContextService, ICodeEditorService 等) |
| **browser/ 不引用 electron-browser/** | ✅ 通过 | browser/ 不使用 Node.js API |
| **electron-browser/ 可引用 common/ + browser/** | ✅ 通过 | electron-browser/ 使用 Node.js fs, child_process, ONNX, git 等 |
| **electron-browser/ 不被 browser/ 引用** | ✅ 通过 | 桌面独有实现不暴露给 web |

### Round 4 新增文件分层验证

| 新增目录 | 层 | 正确性 | 理由 |
|---------|-----|-------|------|
| common/linkify/ | common | ✅ | 接口 + 类型定义，无平台依赖 |
| common/byokExt/ | common | ✅ | 端点类型定义，无 HTTP 客户端 |
| common/intentsExt/ | common | ✅ | Agent 配置类型 + 意图注册接口 |
| common/inlineEditsExt/ | common | ✅ | NES 接口 + 纯算法（editRebase） |
| common/power/ | common | ✅ | 电源管理接口 |
| common/onboardDebug/ | common | ✅ | 调试配置接口 |
| common/telemetryExt/ | common | ✅ | 遥测接口 |
| common/completionsExt/ | common | ✅ | 补全配置/接口 |
| browser/conversationExt/ | browser | ✅ | 使用 VS Code services（IAuthenticationService, ITelemetryService） |
| browser/contextExt/ | browser | ✅ | 使用 VS Code context service abstractions |
| browser/promptExt/ | browser | ✅ | 使用 VS Code endpoint service |
| browser/log/ | browser | ✅ | 使用 VS Code tree view + output channel |
| browser/inlineEditsExt/ | browser | ✅ | 使用 VS Code editor services, Web API |
| browser/completionsExt/ | browser | ✅ | 使用 VS Code inline completion API |
| electron-browser/promptNode/ | electron-browser | ✅ | 使用 Node.js fs, tiktoken, HTTP |
| electron-browser/intentsNode/ | electron-browser | ✅ | 使用 Node.js 文件访问 + 工具执行 |
| electron-browser/toolsNode/ | electron-browser | ✅ | 使用 Node.js fs, child_process, git |
| electron-browser/byokExt/ | electron-browser | ✅ | 使用 Node.js HTTP 客户端 |
| electron-browser/inlineEditsNode/ | electron-browser | ✅ | 使用 Node.js fs, ONNX |
| electron-browser/onboardDebugExt/ | electron-browser | ✅ | 使用 Node.js 进程管理 |
| electron-browser/workspaceRecorderExt/ | electron-browser | ✅ | 使用 Node.js fs.watch, streams |
| electron-browser/chatSessionsExt/ | electron-browser | ✅ | 使用 Node.js fs 持久化 |

## Copilot-Specific (NOT needed by Quiz)

These Copilot directories are GitHub/Copilot-brand-specific and excluded from Quiz:

| Directory | Reason Excluded |
|-----------|---------------|
| `agents/node/` | Copilot-specific agent intents (docIntent.tsx uses prompt-tsx) |
| `chatSessions/claude/` (91 files) | Claude Code integration — Quiz has its own BYOK |
| `chatSessions/copilotcli/` (74+ files) | Copilot CLI shim — not needed |
| `completions-core/` (351 files) | Old Copilot completions engine — separate from chat |
| `typescriptContext/` (112 files) | Copilot-specific TS context — Quiz uses Core's language features |
| `xtab/` (28 files) | Copilot-specific extended tab context |
| `githubMcp/` | GitHub-specific MCP tools |
| `review/` | GitHub PR review — Quiz-specific review mode handled differently |
| `git/vscode/` | GitHub-specific git context — Quiz uses Core's IGitService |
| `api/vscode/` | Copilot public API surface — Quiz is Core built-in, no API needed |
| `extension/` | Extension bootstrap — Quiz is not an extension |
| `otel/` + `trajectory/` | Copilot-specific OpenTelemetry — Quiz uses Core's ITelemetryService |
| `survey/` | Copilot-specific user survey |
| `externalAgents/` | External agent hosting — Quiz handles agents internally |
| `mcp/` | MCP tool calling — Quiz uses Core's ILanguageModelToolsService directly |

## Entry Points

| File | Registered In | Purpose |
|------|--------------|---------|
| `browser/quiz.contribution.ts` | `workbench.common.main.ts` | Browser contribution — all web-safe registrations |
| `electron-browser/quiz.electron.contribution.ts` | `workbench.desktop.main.ts` | Electron contribution — native tools, checkpoint, lifecycle |
