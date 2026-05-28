/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region Quiz Platform Service Interfaces
//
// Quiz is a VS Code Core contribution, so it bridges VS Code's built-in services
// rather than reimplementing Copilot's standalone service layer. This file provides
// Quiz-specific service interfaces that:
//   1. Expose only the subset of VS Code service functionality that Quiz needs
//   2. Provide Null/Noop implementations for testing
//   3. Align with Copilot's service interfaces for feature parity tracking
//
// Copilot has its own DI system (createServiceIdentifier). Quiz uses VS Code's
// createDecorator so it can inject VS Code services directly.

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuizRange, IQuizLocation } from './quizSharedTypes.js';
import type { IQuizEndpointInfo } from './endpoint/quizEndpoint.js';

// #region IQuizDiffService (aligned with Copilot's IDiffService)

export const IQuizDiffService = createDecorator<IQuizDiffService>('quizDiffService');

/**
 * Diff computation service. Bridges VS Code's editor diff infrastructure.
 * Aligned with Copilot's IDiffService (platform/diff/common/diffService.ts).
 */
export interface IQuizDiffService {
	readonly _serviceBrand: undefined;

	/**
	 * Compute the diff between two strings.
	 * Returns line-level changes with detailed range mappings.
	 */
	computeDiff(original: string, modified: string, options?: IQuizDiffOptions): Promise<IQuizDocumentDiff>;
}

export interface IQuizDiffOptions {
	readonly maxComputationTimeMs?: number;
	readonly ignoreTrimWhitespace?: boolean;
}

export interface IQuizDocumentDiff {
	/** True if both texts are identical */
	readonly identical: boolean;
	/** True if computation timed out */
	readonly quitEarly: boolean;
	/** Line range changes */
	readonly changes: readonly IQuizLineRangeMapping[];
}

export interface IQuizLineRangeMapping {
	readonly originalRange: IQuizRange;
	readonly modifiedRange: IQuizRange;
}

// #endregion

// #region IQuizLanguageFeaturesService (aligned with Copilot's ILanguageFeaturesService)

export const IQuizLanguageFeaturesService = createDecorator<IQuizLanguageFeaturesService>('quizLanguageFeaturesService');

/**
 * Language features service. Bridges VS Code's ILanguageFeaturesService.
 * Aligned with Copilot's ILanguageFeaturesService (platform/languages/common/languageFeaturesService.ts).
 */
export interface IQuizLanguageFeaturesService {
	readonly _serviceBrand: undefined;

	getDefinitions(uri: URI, position: IQuizLocation): Promise<IQuizLocation[]>;
	getImplementations(uri: URI, position: IQuizLocation): Promise<IQuizLocation[]>;
	getReferences(uri: URI, position: IQuizLocation): Promise<IQuizLocation[]>;
	getWorkspaceSymbols(query: string): Promise<IQuizSymbolInformation[]>;
	getDocumentSymbols(uri: URI): Promise<IQuizDocumentSymbol[]>;
	getDiagnostics(uri: URI): IQuizDiagnostic[];
}

export interface IQuizSymbolInformation {
	readonly name: string;
	readonly kind: number;
	readonly location: IQuizLocation;
	readonly containerName?: string;
}

export interface IQuizDocumentSymbol {
	readonly name: string;
	readonly kind: number;
	readonly range: IQuizRange;
	readonly selectionRange: IQuizRange;
	readonly children?: IQuizDocumentSymbol[];
}

export interface IQuizDiagnostic {
	readonly message: string;
	readonly range: IQuizRange;
	readonly severity: number;
	readonly source?: string;
	readonly code?: string | number;
}

// #endregion

// #region IQuizCommandExecutionService (aligned with Copilot's IRunCommandExecutionService)

export const IQuizCommandExecutionService = createDecorator<IQuizCommandExecutionService>('quizCommandExecutionService');

/**
 * Command execution service. Bridges VS Code's ICommandService.
 * Aligned with Copilot's IRunCommandExecutionService (platform/commands/common/runCommandExecutionService.ts).
 */
export interface IQuizCommandExecutionService {
	readonly _serviceBrand: undefined;

	executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T>;
}

// #endregion

// #region IQuizExtensionsService (aligned with Copilot's IExtensionsService)

export const IQuizExtensionsService = createDecorator<IQuizExtensionsService>('quizExtensionsService');

/**
 * Extension discovery service. Bridges VS Code's IExtensionService.
 * Aligned with Copilot's IExtensionsService (platform/extensions/common/extensionsService.ts).
 */
export interface IQuizExtensionsService {
	readonly _serviceBrand: undefined;

	/** Get an extension by its ID */
	getExtension(extensionId: string): IQuizExtension | undefined;
	/** All installed extensions */
	readonly all: readonly IQuizExtension[];
	/** Fires when extensions change */
	readonly onDidChange: Event<void>;
}

export interface IQuizExtension {
	readonly id: string;
	readonly isActive: boolean;
	readonly packageJSON?: { contributes?: { [section: string]: unknown } };
}

// #endregion

// #region IQuizNotificationService (aligned with Copilot's INotificationService)

export const IQuizNotificationService = createDecorator<IQuizNotificationService>('quizNotificationService');

/**
 * Notification service. Bridges VS Code's INotificationService.
 * Aligned with Copilot's INotificationService (platform/notification/common/notificationService.ts).
 */
export interface IQuizNotificationService {
	readonly _serviceBrand: undefined;

	showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
	showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
	showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
	withProgress<R>(
		options: IQuizProgressOptions,
		task: (progress: IQuizProgress<{ message?: string; increment?: number }>, token: CancellationToken) => Promise<R>,
	): Promise<R>;
}

export interface IQuizProgressOptions {
	readonly title?: string;
	readonly location: number;
	readonly cancellable?: boolean;
}

export interface IQuizProgress<T> {
	report(value: T): void;
}

// #endregion

// #region IQuizFileTypeService (aligned with Copilot's fileTypes.ts)

/**
 * File type detection and classification.
 * Aligned with Copilot's fileTypes.ts (platform/filesystem/common/fileTypes.ts).
 * Quiz can use VS Code's IWorkspaceContextService + language detection directly,
 * but this interface provides a convenient abstraction for tool behavior decisions.
 */
export const IQuizFileTypeService = createDecorator<IQuizFileTypeService>('quizFileTypeService');

export interface IQuizFileTypeService {
	readonly _serviceBrand: undefined;

	/**
	 * Detect the language ID for a file URI based on its path/extension.
	 */
	getLanguageId(uri: URI): string | undefined;

	/**
	 * Check if a file is a binary file (image, font, etc.) based on extension.
	 */
	isBinaryFile(uri: URI): boolean;

	/**
	 * Check if a file is a notebook file.
	 */
	isNotebookFile(uri: URI): boolean;

	/**
	 * Get the file extension (without dot) from a URI.
	 */
	getExtension(uri: URI): string;
}

// #endregion

// #region IQuizPromptsFileService (aligned with Copilot's IPromptsService)

export const IQuizPromptsFileService = createDecorator<IQuizPromptsFileService>('quizPromptsFileService');

/**
 * Custom prompt file parsing service.
 * Aligned with Copilot's IPromptsService (platform/prompts/common/promptsService.ts).
 * Bridges VS Code's built-in prompts/contributed prompt system.
 */
export interface IQuizPromptsFileService {
	readonly _serviceBrand: undefined;

	/**
	 * Get all custom instruction files from the workspace.
	 */
	getCustomInstructions(token: CancellationToken): Promise<IQuizCustomInstruction[]>;

	/**
	 * Get the content of a specific prompt file.
	 */
	getPromptFileContent(uri: URI, token: CancellationToken): Promise<string | undefined>;
}

export interface IQuizCustomInstruction {
	readonly uri: URI;
	readonly name: string;
	readonly description?: string;
}

// #endregion

// #region IQuizPromptCache (aligned with Copilot's cache.ts)

/**
 * Prompt caching mechanism for reducing redundant LLM calls.
 * Aligned with Copilot's cache.ts (platform/chat/common/cache.ts).
 */
export interface IQuizPromptCache {
	/**
	 * Get a cached prompt result if available.
	 */
	get(key: string): IQuizCachedPrompt | undefined;

	/**
	 * Store a prompt result in the cache.
	 */
	set(key: string, value: IQuizCachedPrompt): void;

	/**
	 * Invalidate cache entries matching a predicate.
	 */
	invalidate(predicate: (key: string) => boolean): void;

	/**
	 * Clear all cached entries.
	 */
	clear(): void;
}

export interface IQuizCachedPrompt {
	readonly messages: unknown[];
	readonly tokenCount: number;
	readonly timestamp: number;
	readonly ttlMs: number;
}

// #endregion

// #region IQuizTabsAndEditorsService (aligned with Copilot's tabsAndEditorsService.ts)

export const IQuizTabsAndEditorsService = createDecorator<IQuizTabsAndEditorsService>('quizTabsAndEditorsService');

/**
 * Tab and editor state service. Bridges VS Code's IEditorService and IEditorGroupsService.
 * Aligned with Copilot's tabsAndEditorsService.ts (platform/editors/common/tabsAndEditorsService.ts).
 * Extends Quiz's existing IQuizContextProvider with fine-grained tab/editor info.
 */
export interface IQuizTabsAndEditorsService {
	readonly _serviceBrand: undefined;

	/** Currently active editor */
	readonly activeEditor: IQuizEditorState | undefined;
	/** All open editors */
	readonly visibleEditors: readonly IQuizEditorState[];
	/** All open tabs */
	readonly openTabs: readonly IQuizTabInfo[];
	/** Fires when active editor changes */
	readonly onDidChangeActiveEditor: Event<IQuizEditorState | undefined>;
	/** Fires when open tabs change */
	readonly onDidChangeTabs: Event<void>;
}

export interface IQuizEditorState {
	readonly uri: URI;
	readonly languageId: string;
	readonly isDirty: boolean;
	readonly selection?: IQuizRange;
	readonly visibleRanges?: readonly IQuizRange[];
}

export interface IQuizTabInfo {
	readonly uri: URI;
	readonly label: string;
	readonly isDirty: boolean;
	readonly isPinned: boolean;
	readonly isPreview: boolean;
}

// #endregion

// #region IQuizGitService (aligned with Copilot's gitExtensionService.ts)

export const IQuizGitService = createDecorator<IQuizGitService>('quizGitService');

/**
 * Git service. Bridges VS Code's built-in Git extension API.
 * Aligned with Copilot's gitExtensionService.ts (platform/git/common/gitService.ts).
 * Extends Quiz's existing IQuizGitContext type with actual service operations.
 */
export interface IQuizGitService {
	readonly _serviceBrand: undefined;

	/** Current branch name */
	readonly branch: string | undefined;
	/** List of changed files */
	readonly changedFiles: readonly string[];
	/** Whether git is available for the current workspace */
	readonly isAvailable: boolean;
	/** Fires when git state changes */
	readonly onDidChange: Event<void>;

	/**
	 * Get the diff for a specific file.
	 */
	getFileDiff(uri: URI, token: CancellationToken): Promise<string | undefined>;

	/**
	 * Get the list of recent commits.
	 */
	getRecentCommits(count: number, token: CancellationToken): Promise<IQuizGitCommit[]>;
}

export interface IQuizGitCommit {
	readonly hash: string;
	readonly message: string;
	readonly author?: string;
	readonly date?: string;
}

// #endregion

// #region IQuizTerminalService (aligned with Copilot's terminalService.ts)

export const IQuizTerminalService = createDecorator<IQuizTerminalService>('quizTerminalService');

/**
 * Terminal service. Bridges VS Code's ITerminalService.
 * Aligned with Copilot's terminalService.ts.
 * Provides service-level operations beyond tool registration.
 */
export interface IQuizTerminalService {
	readonly _serviceBrand: undefined;

	/**
	 * Execute a command in a terminal and return the output.
	 */
	executeCommand(command: string, options?: IQuizTerminalOptions): Promise<IQuizTerminalResult>;

	/**
	 * Get the output of the most recent terminal command.
	 */
	getRecentOutput(): string | undefined;

	/**
	 * Check if a terminal is available.
	 */
	isAvailable(): boolean;
}

export interface IQuizTerminalOptions {
	readonly cwd?: URI;
	readonly env?: Record<string, string>;
	readonly name?: string;
}

export interface IQuizTerminalResult {
	readonly output: string;
	readonly exitCode: number | undefined;
}

// #endregion

// #region IQuizNotebookService (aligned with Copilot's notebookService.ts)

export const IQuizNotebookService = createDecorator<IQuizNotebookService>('quizNotebookService');

/**
 * Notebook service. Bridges VS Code's INotebookService.
 * Aligned with Copilot's notebookService.ts.
 * Provides service-level operations beyond tool registration.
 */
export interface IQuizNotebookService {
	readonly _serviceBrand: undefined;

	/**
	 * Get notebook document data for a URI.
	 */
	getNotebookData(uri: URI, token: CancellationToken): Promise<IQuizNotebookData | undefined>;

	/**
	 * Get the output of a specific cell.
	 */
	getCellOutput(uri: URI, cellIndex: number, token: CancellationToken): Promise<string | undefined>;
}

export interface IQuizNotebookData {
	readonly uri: URI;
	readonly cellCount: number;
	readonly cells: readonly IQuizNotebookCell[];
}

export interface IQuizNotebookCell {
	readonly index: number;
	readonly languageId: string;
	readonly source: string;
	readonly cellKind: number;
}

// #endregion

// #region IQuizFileSystemService (aligned with Copilot's fileSystem.ts)

export const IQuizFileSystemService = createDecorator<IQuizFileSystemService>('quizFileSystemService');

/**
 * File system abstraction. Bridges VS Code's IFileService.
 * Aligned with Copilot's fileSystem.ts.
 * Provides a Quiz-specific interface independent of tool registration.
 */
export interface IQuizFileSystemService {
	readonly _serviceBrand: undefined;

	/**
	 * Read a file's content as text.
	 */
	readFile(uri: URI): Promise<string>;

	/**
	 * Write content to a file.
	 */
	writeFile(uri: URI, content: string): Promise<void>;

	/**
	 * Check if a file exists.
	 */
	exists(uri: URI): Promise<boolean>;

	/**
	 * List directory entries.
	 */
	readDirectory(uri: URI): Promise<IQuizDirectoryEntry[]>;

	/**
	 * Create a directory recursively.
	 */
	createDirectory(uri: URI): Promise<void>;

	/**
	 * Delete a file or directory.
	 */
	delete(uri: URI, options?: IQuizFileDeleteOptions): Promise<void>;

	/**
	 * Watch a file or directory for changes.
	 */
	watch(uri: URI, options?: IQuizFileWatchOptions): IDisposable;
}

export interface IQuizDirectoryEntry {
	readonly name: string;
	readonly uri: URI;
	readonly isFile: boolean;
	readonly isDirectory: boolean;
}

export interface IQuizFileDeleteOptions {
	readonly recursive?: boolean;
	readonly useTrash?: boolean;
}

export interface IQuizFileWatchOptions {
	readonly recursive?: boolean;
	readonly excludes?: readonly string[];
}

// #endregion

// #region IQuizFetcherService (aligned with Copilot's IFetcherService)

// Re-export from endpoint module for convenience
export { IQuizFetcherService, NullQuizFetcherService, NO_FETCH_TELEMETRY } from './endpoint/quizFetcher.js';
export type { IQuizFetchOptions, IQuizWebSocketOptions, IQuizWebSocketConnection, IQuizWebSocketReadyState, IQuizAbortSignal, IQuizAbortController, IQuizFetcherResponse, IQuizFetchEvent, IQuizFetchTelemetryEvent, IQuizPaginationOptions } from './endpoint/quizFetcher.js';

// #endregion

// #region IQuizQAPIClientService (aligned with Copilot's ICAPIClientService)

// Re-export from endpoint module for convenience
export { IQuizQAPIClientService, NullQuizQAPIClientService, QuizRequestType } from './endpoint/quizQAPIClient.js';
export type { QuizRequestMetadata, IQuizMakeRequestOptions, IQuizCopilotToken, IQuizDomainChangeResponse, IQuizExtensionInformation } from './endpoint/quizQAPIClient.js';

// #endregion

// #region IQuizNetworkService (aligned with Copilot's networkRequest routing)

// Re-export from endpoint module for convenience
export { IQuizNetworkService, NullQuizNetworkService, quizNetworkRequest, canRetryOnceNetworkError, QUIZ_REQUEST_TIMEOUT_MS } from './endpoint/quizNetwork.js';
export type { IQuizNetworkRequestEndpoint, IQuizNetworkRequest, IQuizNetworkResponse, IQuizNetworkStreamChunk, IQuizWebSocketStreamConnection, IQuizNetworkRequestOptions } from './endpoint/quizNetwork.js';

// #endregion

// #region New endpoint types re-exports (aligned with Copilot's networking types)

export type { IQuizInteractionTypeOverride, IQuizChatRequestTelemetryProperties } from './endpoint/quizEndpoint.js';
export { QuizModelSupportedEndpoint } from './endpoint/quizEndpoint.js';
export { getQuizModelCapabilityOverride, quizModelPrefersInstructionsInUserMessage, quizModelPrefersInstructionsAfterHistory, quizModelSupportsApplyPatch, quizModelSupportsReplaceString, quizModelSupportsMultiReplaceString, quizModelCanUseReplaceStringExclusively, quizModelShouldUseReplaceStringHealing, quizModelCanUseMcpResultImageURL, quizModelSupportsPDFDocuments, quizModelCanUseApplyPatchExclusively, quizModelNeedsStrongReplaceStringHint, quizModelSupportsSimplifiedApplyPatchInstructions, quizModelPrefersJsonNotebookRepresentation, isQuizMinimaxFamily, isQuizGpt5PlusFamily, isQuizGptCodexFamily, isQuizGpt5Family, isQuizGptFamily, isQuizGpt51Family, getQuizVerbosityForModelSync } from './endpoint/quizModelCapabilities.js';
export type { IQuizModelCapabilityOverride } from './endpoint/quizModelCapabilities.js';

// #endregion

// #region IQuizEndpointInfoService (aligned with Copilot's IChatEndpoint read-only subset)

export const IQuizEndpointInfoService = createDecorator<IQuizEndpointInfoService>('quizEndpointInfoService');

/**
 * Provides lightweight endpoint info for prompt building decisions.
 * Aligned with the read-only subset of Copilot's IChatEndpoint.
 *
 * This is the service-level access point for code that needs model
 * capabilities but should NOT send requests (e.g., prompt variant
 * selection, tool schema normalization, token budgeting).
 *
 * For full endpoint access (including sendChatRequest), use IQuizEndpointProvider.
 */
export interface IQuizEndpointInfoService {
	readonly _serviceBrand: undefined;

	/** Get endpoint info for the default model */
	getDefaultEndpointInfo(): Promise<IQuizEndpointInfo | undefined>;

	/** Get endpoint info for a specific model ID */
	getEndpointInfo(modelId: string): Promise<IQuizEndpointInfo | undefined>;

	/** Get all available endpoint infos */
	getAllEndpointInfos(): Promise<readonly IQuizEndpointInfo[]>;

	/** Fires when the set of available models changes */
	readonly onDidChangeModels: Event<void>;
}

// Re-export IQuizEndpointInfo from endpoint module for convenience
export { IQuizEndpointInfo } from './endpoint/quizEndpoint.js';

/** Null endpoint info service for testing */
export class NullQuizEndpointInfoService implements IQuizEndpointInfoService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeModels = Event.None;

	async getDefaultEndpointInfo(): Promise<IQuizEndpointInfo | undefined> { return undefined; }
	async getEndpointInfo(_modelId: string): Promise<IQuizEndpointInfo | undefined> { return undefined; }
	async getAllEndpointInfos(): Promise<readonly IQuizEndpointInfo[]> { return []; }
}

// #endregion

// #region IQuizAuthService (aligned with Copilot's CopilotToken / auth)

export const IQuizAuthService = createDecorator<IQuizAuthService>('quizAuthService');

/**
 * Authentication service. Bridges VS Code's authentication API.
 * Aligned with Copilot's CopilotToken + IAuthenticationService.
 * Extends Quiz's existing IQuizAuthProvider with token refresh and claims.
 */
export interface IQuizAuthService {
	readonly _serviceBrand: undefined;

	/** Whether the user is authenticated */
	readonly isAuthenticated: boolean;
	/** Fires when auth state changes */
	readonly onDidChangeAuthentication: Event<boolean>;

	/**
	 * Get the current authentication token.
	 * Handles refresh automatically if the token is expired.
	 */
	getToken(): Promise<string | undefined>;

	/**
	 * Get parsed token claims (e.g., user info, scopes).
	 */
	getTokenClaims(): IQuizTokenClaims | undefined;

	/**
	 * Refresh the authentication token.
	 */
	refreshToken(): Promise<void>;
}

export interface IQuizTokenClaims {
	readonly sub?: string;
	readonly tid?: string;
	readonly scope?: string;
	readonly exp?: number;
	readonly iat?: number;
}

// #endregion

// #region Null service implementations

/** Null diff service for testing */
export class NullQuizDiffService implements IQuizDiffService {
	declare readonly _serviceBrand: undefined;
	async computeDiff(): Promise<IQuizDocumentDiff> {
		return { identical: true, quitEarly: false, changes: [] };
	}
}

/** Null language features service for testing */
export class NullQuizLanguageFeaturesService implements IQuizLanguageFeaturesService {
	declare readonly _serviceBrand: undefined;
	async getDefinitions(): Promise<IQuizLocation[]> { return []; }
	async getImplementations(): Promise<IQuizLocation[]> { return []; }
	async getReferences(): Promise<IQuizLocation[]> { return []; }
	async getWorkspaceSymbols(): Promise<IQuizSymbolInformation[]> { return []; }
	async getDocumentSymbols(): Promise<IQuizDocumentSymbol[]> { return []; }
	getDiagnostics(): IQuizDiagnostic[] { return []; }
}

/** Null command execution service for testing */
export class NullQuizCommandExecutionService implements IQuizCommandExecutionService {
	declare readonly _serviceBrand: undefined;
	async executeCommand<T>(): Promise<T> { return undefined as unknown as T; }
}

/** Null extensions service for testing */
export class NullQuizExtensionsService implements IQuizExtensionsService {
	declare readonly _serviceBrand: undefined;
	readonly all: readonly IQuizExtension[] = [];
	readonly onDidChange = Event.None;
	getExtension(): IQuizExtension | undefined { return undefined; }
}

/** Null notification service for testing */
export class NullQuizNotificationService implements IQuizNotificationService {
	declare readonly _serviceBrand: undefined;
	async showInformationMessage(): Promise<string | undefined> { return undefined; }
	async showWarningMessage(): Promise<string | undefined> { return undefined; }
	async showErrorMessage(): Promise<string | undefined> { return undefined; }
	async withProgress<R>(_options: IQuizProgressOptions, task: (progress: IQuizProgress<{ message?: string; increment?: number }>, token: CancellationToken) => Promise<R>): Promise<R> {
		return task({ report: () => { } }, CancellationToken.None);
	}
}

/** Null file type service for testing */
export class NullQuizFileTypeService implements IQuizFileTypeService {
	declare readonly _serviceBrand: undefined;
	getLanguageId(): string | undefined { return undefined; }
	isBinaryFile(): boolean { return false; }
	isNotebookFile(): boolean { return false; }
	getExtension(): string { return ''; }
}

/** Null prompts file service for testing */
export class NullQuizPromptsFileService implements IQuizPromptsFileService {
	declare readonly _serviceBrand: undefined;
	async getCustomInstructions(): Promise<IQuizCustomInstruction[]> { return []; }
	async getPromptFileContent(): Promise<string | undefined> { return undefined; }
}

/** Null tabs and editors service for testing */
export class NullQuizTabsAndEditorsService implements IQuizTabsAndEditorsService {
	declare readonly _serviceBrand: undefined;
	readonly activeEditor: IQuizEditorState | undefined = undefined;
	readonly visibleEditors: readonly IQuizEditorState[] = [];
	readonly openTabs: readonly IQuizTabInfo[] = [];
	readonly onDidChangeActiveEditor = Event.None;
	readonly onDidChangeTabs = Event.None;
}

/** Null git service for testing */
export class NullQuizGitService implements IQuizGitService {
	declare readonly _serviceBrand: undefined;
	readonly branch: string | undefined = undefined;
	readonly changedFiles: readonly string[] = [];
	readonly isAvailable = false;
	readonly onDidChange = Event.None;
	async getFileDiff(): Promise<string | undefined> { return undefined; }
	async getRecentCommits(): Promise<IQuizGitCommit[]> { return []; }
}

/** Null terminal service for testing */
export class NullQuizTerminalService implements IQuizTerminalService {
	declare readonly _serviceBrand: undefined;
	async executeCommand(): Promise<IQuizTerminalResult> { return { output: '', exitCode: undefined }; }
	getRecentOutput(): string | undefined { return undefined; }
	isAvailable(): boolean { return false; }
}

/** Null notebook service for testing */
export class NullQuizNotebookService implements IQuizNotebookService {
	declare readonly _serviceBrand: undefined;
	async getNotebookData(): Promise<IQuizNotebookData | undefined> { return undefined; }
	async getCellOutput(): Promise<string | undefined> { return undefined; }
}

/** Null file system service for testing */
export class NullQuizFileSystemService implements IQuizFileSystemService {
	declare readonly _serviceBrand: undefined;
	async readFile(): Promise<string> { return ''; }
	async writeFile(): Promise<void> { }
	async exists(): Promise<boolean> { return false; }
	async readDirectory(): Promise<IQuizDirectoryEntry[]> { return []; }
	async createDirectory(): Promise<void> { }
	async delete(): Promise<void> { }
	watch(): IDisposable { return { dispose: () => { } }; }
}

/** Null auth service for testing */
export class NullQuizAuthService implements IQuizAuthService {
	declare readonly _serviceBrand: undefined;
	readonly isAuthenticated = false;
	readonly onDidChangeAuthentication = Event.None;
	async getToken(): Promise<string | undefined> { return undefined; }
	getTokenClaims(): IQuizTokenClaims | undefined { return undefined; }
	async refreshToken(): Promise<void> { }
}

// #endregion

// #region In-memory prompt cache implementation

/**
 * Simple in-memory prompt cache with TTL support.
 * Aligned with Copilot's cache.ts.
 */
export class QuizPromptCache implements IQuizPromptCache {
	private readonly _cache = new Map<string, IQuizCachedPrompt>();

	get(key: string): IQuizCachedPrompt | undefined {
		const entry = this._cache.get(key);
		if (!entry) {
			return undefined;
		}
		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttlMs) {
			this._cache.delete(key);
			return undefined;
		}
		return entry;
	}

	set(key: string, value: IQuizCachedPrompt): void {
		this._cache.set(key, value);
	}

	invalidate(predicate: (key: string) => boolean): void {
		for (const key of this._cache.keys()) {
			if (predicate(key)) {
				this._cache.delete(key);
			}
		}
	}

	clear(): void {
		this._cache.clear();
	}
}

// #endregion

// #region Domain service re-exports (aligned with Copilot's IDomainService)

export { IQuizDomainService, NullQuizDomainService } from './endpoint/quizDomainService.js';
export type { IQuizDomainChangeEvent } from './endpoint/quizDomainService.js';

// #endregion

// #region Capturing token re-exports (aligned with Copilot's CapturingToken)

export { QuizCapturingToken } from './requestLogger/quizCapturingToken.js';

// #endregion

// #region GenAI attributes re-exports (aligned with Copilot's genAiAttributes)

export {
	QuizGenAiOperationName, QuizGenAiProviderName, QuizGenAiTokenType,
	QuizGenAiToolType, QuizGenAiAttr, QuizChatAttr, QuizStdAttr,
	QUIZ_SHELL_TOOL_NAMES, QUIZ_FILE_TOOL_NAMES, QUIZ_TOOL_PARAM_COMMAND_MAX_LEN,
} from './telemetry/quizGenAiAttributes.js';
export type { QuizEditSource, QuizEditOutcome, QuizAgentType, QuizHookDecision } from './telemetry/quizGenAiAttributes.js';

// #endregion

// #region Embeddings service re-exports (aligned with Copilot's IEmbeddingsComputer)

export {
	IQuizEmbeddingsService, NullQuizEmbeddingsService,
	QuizEmbeddingType, QuizLegacyEmbeddingModelId,
	getQuizEmbeddingTypeInfo, isValidQuizEmbedding,
	quizEmbeddingDistance, quizRankEmbeddings,
} from './embeddings/quizEmbeddingsService.js';
export type {
	QuizEmbeddingVector, QuizEmbedding, QuizEmbeddings,
	QuizEmbeddingDistance, QuizEmbeddingTypeInfo,
	QuizEmbeddingInputType, QuizComputeEmbeddingsOptions,
} from './embeddings/quizEmbeddingsService.js';

// #endregion

// #region Ignore service re-exports (aligned with Copilot's IIgnoreService)

export {
	IQuizIgnoreService, NullQuizIgnoreService,
	QUIZ_HAS_IGNORED_FILES_MESSAGE,
	quizFilterIgnoredResources,
} from './ignore/quizIgnoreService.js';

// #endregion

// #region Language context service re-exports (aligned with Copilot's ILanguageContextService)

export {
	IQuizLanguageContextService, NullQuizLanguageContextService,
	QuizContextKind, QuizKnownSources, QuizTriggerKind,
} from './languageServer/quizLanguageContextService.js';
export type {
	IQuizSnippetContext, IQuizTraitContext, IQuizDiagnosticBagContext,
	IQuizContextDiagnostic, IQuizContextItem,
	IQuizRequestContext, IQuizTextDocumentInfo, IQuizPosition,
} from './languageServer/quizLanguageContextService.js';

// #endregion

// #region Tree-sitter languages re-exports (aligned with Copilot's treeSitterLanguages)

export {
	QuizWasmLanguage, QuizTreeSitterUnknownLanguageError,
	getQuizWasmLanguage, isQuizTreeSitterSupportedLanguage,
} from './parser/quizTreeSitterLanguages.js';

// #endregion

// #region Experimentation service re-exports (aligned with Copilot's IExperimentationService)

export {
	IQuizExperimentationService, NullQuizExperimentationService,
} from './telemetry/quizExperimentationService.js';
export type { IQuizTreatmentsChangeEvent } from './telemetry/quizExperimentationService.js';

// #endregion

// #region OTel config re-exports (aligned with Copilot's otelConfig)

export {
	resolveQuizOTelConfig,
	QUIZ_DEFAULT_OTLP_ENDPOINT, QUIZ_OTEL_SERVICE_NAME,
} from './otel/quizOtelConfig.js';
export type {
	IQuizOTelConfig, IQuizOTelConfigInput,
	QuizOTelExporterType, QuizOTelEnabledVia,
} from './otel/quizOtelConfig.js';

// #endregion

// #region Workspace log re-exports (aligned with Copilot's workspaceLog)

export type {
	QuizLogDocumentId, QuizLogEntry,
	IQuizDocumentLogEntry,
	IQuizHeaderLogEntry, IQuizApplicationStartLogEntry,
	IQuizDocumentSetContentLogEntry, IQuizDocumentStoreContentLogEntry,
	IQuizDocumentRestoreContentLogEntry, IQuizDocumentOpenedLogEntry,
	IQuizDocumentClosedLogEntry, IQuizDocumentChangedLogEntry,
	IQuizDocumentFocusChangedLogEntry, IQuizDocumentSelectionChangedLogEntry,
	IQuizDocumentEncounteredLogEntry, IQuizDocumentEventLogEntry,
	IQuizEventLogEntry, IQuizMetaLogEntry, IQuizBookmarkLogEntry,
	IQuizChangedMetadata, IQuizSerializedOffsetRange, IQuizSerializedEdit,
	IQuizDocumentEventLogEntryData, IQuizEventLogEntryData,
	IQuizDocumentEventDataSetChangeReason, IQuizEventFetchEnd,
} from './workspaceRecorder/quizWorkspaceLog.js';

// #endregion

// #region Chat types re-exports (aligned with Copilot's platform/chat/common/commonTypes.ts)

export {
	QuizFetchResponseKind, QuizChatFailKind, QuizChatFetchResponseType,
	QuizChatLocation, QuizFilterReason,
	QUIZ_RESPONSE_CONTAINED_NO_CHOICES, QUIZ_CANCELED_MESSAGE,
} from './chat/quizChatTypes.js';
export type {
	IQuizChatResults, IQuizChatRequestFailed, IQuizChatRequestCanceled,
	QuizChatFetchResult, QuizChatFetchError,
	IQuizChatCompletion, IQuizToolCall,
	IQuizResponseDelta, IQuizToolCallDelta, IQuizCodeVulnAnnotation,
	IQuizAPIErrorResponse, IQuizAPIUsage,
	QuizFetchSuccess, QuizFetchResponse, QuizChatResponse, QuizChatResponses,
	QuizInteractionTypeOverride, IQuizChatErrorDetails,
	IQuizChatQuotaService,
} from './chat/quizChatTypes.js';

// #endregion

// #region Chat WebSocket manager re-exports (aligned with Copilot's IChatWebSocketManager)

export {
	IQuizChatWebSocketManager, NullQuizChatWebSocketManager,
	isQuizCAPIWebSocketError,
} from './chat/quizChatWebSocketManager.js';
export type {
	IQuizChatWebSocketConnection, IQuizChatWebSocketRequestOptions,
	IQuizChatWebSocketRequestHandle, IQuizCAPIWebSocketErrorEvent,
	IQuizWebSocketStreamEvent,
} from './chat/quizChatWebSocketManager.js';

// #endregion

// #region Chat stream processor re-exports (aligned with Copilot's chatStream/processResponseFromChatEndpoint)

export {
	quizParseSSEStream, quizProcessStreamResponse,
	quizClassifyFetchError,
	QuizFetchStreamSource, QuizFetchStreamRecorder,
} from './chat/quizChatStreamProcessor.js';
export type {
	IQuizSSEEvent, IQuizResponsePart, QuizFinishedCallback,
} from './chat/quizChatStreamProcessor.js';

// #endregion

// #region ChatMLFetcher re-exports (aligned with Copilot's IChatMLFetcher)

export {
	IQuizChatMLFetcher,
} from './chat/quizChatMLFetcher.js';
export type {
	IQuizFetchMLOptions, IQuizOptionalChatRequestParams,
	IQuizMadeChatRequestEvent, IQuizFetchSource,
} from './chat/quizChatMLFetcher.js';

// #endregion
