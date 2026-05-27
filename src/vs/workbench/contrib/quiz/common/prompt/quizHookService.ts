/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's hook system architecture:
//   platform/chat/common/chatHookService.ts      — IChatHookService interface + IPre/PostToolUseHookResult
//   platform/chat/common/hookCommandTypes.ts      — PreToolUse/PostToolUse command input/output JSON contracts
//   platform/chat/common/hookExecutor.ts          — IHookExecutor + HookCommandResultKind + IHookCommandResult
//   platform/chat/common/hooksOutputChannel.ts    — IHooksOutputChannel
//   extension/intents/node/hookResultProcessor.ts — processHookResults + HookAbortError + HookResult
//   extension/chat/vscode-node/chatHookService.ts — ChatHookService implementation
//   extension/chat/vscode-node/chatHookTelemetry.ts — ChatHookTelemetry
//
// This file consolidates the common/ layer types for Quiz.
// Pure types — no DI, no platform API (common/ layer).

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

// #region IQuizChatHookService (aligned with Copilot's IChatHookService)

export const IQuizChatHookService = createDecorator<IQuizChatHookService>('quizChatHookService');

/**
 * Service for executing chat hooks that can intercept and modify agent behavior.
 * Aligned with Copilot's IChatHookService (platform/chat/common/chatHookService.ts).
 *
 * The implementation lives in the browser/ or electron-browser/ layer,
 * using IQuizHookExecutor to spawn hook commands and IQuizHooksOutputChannel
 * for logging.
 */
export interface IQuizChatHookService {
	readonly _serviceBrand: undefined;

	/**
	 * Log telemetry about which hook types are configured for a request.
	 * Aligned with Copilot's ChatHookTelemetry.logConfiguredHooks.
	 */
	logConfiguredHooks(hooks: IQuizChatRequestHooks | undefined): void;

	/**
	 * Execute all hooks of the specified type for the current chat session.
	 * Hooks are sourced from the resolved hook commands on the chat request.
	 *
	 * If a sessionId is provided, the session transcript is flushed to disk
	 * before the hook runs so that hook scripts see up-to-date content.
	 *
	 * Aligned with Copilot's ChatHookService.executeHook.
	 */
	executeHook(
		hookType: QuizChatHookType,
		hooks: IQuizChatRequestHooks | undefined,
		input: unknown,
		sessionId?: string,
		token?: CancellationToken,
	): Promise<IQuizHookResult[]>;

	/**
	 * Execute the preToolUse hook and collapse results from all hooks into a single result.
	 *
	 * Multiple hooks' decisions are collapsed using the most restrictive rule: deny > ask > allow.
	 * updatedInput uses the last hook's value. additionalContext is collected from all hooks.
	 *
	 * Aligned with Copilot's ChatHookService.executePreToolUseHook.
	 */
	executePreToolUseHook(
		toolName: string,
		toolInput: unknown,
		toolCallId: string,
		hooks: IQuizChatRequestHooks | undefined,
		sessionId?: string,
		token?: CancellationToken,
		outputStream?: IQuizHookOutputStream,
	): Promise<IQuizPreToolUseHookResult | undefined>;

	/**
	 * Execute the postToolUse hook and collapse results from all hooks into a single result.
	 *
	 * Called after a tool completes successfully. If any hook returns a 'block' decision,
	 * the block is included in the result. additionalContext is collected from all hooks.
	 *
	 * Aligned with Copilot's ChatHookService.executePostToolUseHook.
	 */
	executePostToolUseHook(
		toolName: string,
		toolInput: unknown,
		toolResponseText: string,
		toolCallId: string,
		hooks: IQuizChatRequestHooks | undefined,
		sessionId?: string,
		token?: CancellationToken,
		outputStream?: IQuizHookOutputStream,
	): Promise<IQuizPostToolUseHookResult | undefined>;
}

// #endregion

// #region IQuizHookExecutor (aligned with Copilot's IHookExecutor)

export const IQuizHookExecutor = createDecorator<IQuizHookExecutor>('quizHookExecutor');

/**
 * Executes a single hook command by spawning a child process.
 * Aligned with Copilot's IHookExecutor (platform/chat/common/hookExecutor.ts).
 *
 * The Node implementation lives in the node/ layer; the browser layer
 * provides a no-op implementation.
 */
export interface IQuizHookExecutor {
	readonly _serviceBrand: undefined;

	/**
	 * Execute a single hook command, writing JSON input to stdin
	 * and capturing stdout/stderr.
	 *
	 * Exit code semantics:
	 * - 0: Success (stdout parsed as JSON if valid)
	 * - 2: Blocking error (stderr returned, shown to model)
	 * - other non-zero: Non-blocking error (stderr returned, shown to user only)
	 */
	executeCommand(
		hookCommand: IQuizChatHookCommand,
		input: unknown,
		token: CancellationToken,
	): Promise<IQuizHookCommandResult>;
}

// #endregion

// #region IQuizHooksOutputChannel (aligned with Copilot's IHooksOutputChannel)

export const IQuizHooksOutputChannel = createDecorator<IQuizHooksOutputChannel>('quizHooksOutputChannel');

/**
 * Output channel for hook execution logs.
 * Aligned with Copilot's IHooksOutputChannel (platform/chat/common/hooksOutputChannel.ts).
 */
export interface IQuizHooksOutputChannel {
	readonly _serviceBrand: undefined;

	/**
	 * Append a line to the Hooks output channel.
	 */
	appendLine(message: string): void;
}

// #endregion

// #region Hook output stream (aligned with Copilot's ChatResponseStream.hookProgress)

/**
 * Output stream for displaying hook messages in the chat response.
 * Aligned with vscode.ChatResponseStream.hookProgress.
 *
 * hookProgress signature matches Copilot's:
 *   hookProgress(hookType: string, errorMessage?: string, warningMessage?: string): void
 */
export interface IQuizHookOutputStream {
	hookProgress(hookType: string, errorMessage?: string, warningMessage?: string): void;
}

// #endregion

// #region Hook types (aligned with Copilot's ChatHookType / vscode.ChatHookType)

/**
 * Types of hooks that can be executed in the chat agent system.
 * Aligned with vscode.ChatHookType.
 */
export type QuizChatHookType =
	| 'SessionStart'
	| 'Stop'
	| 'SubagentStart'
	| 'SubagentStop'
	| 'PreToolUse'
	| 'PostToolUse'
	| 'UserPromptSubmit'
	| 'PreCompact';

// #endregion

// #region Chat request hooks (aligned with Copilot's ChatRequestHooks / vscode.ChatRequestHooks)

/**
 * Resolved hook commands for a chat request, keyed by hook type.
 * Aligned with vscode.ChatRequestHooks.
 */
export interface IQuizChatRequestHooks {
	readonly [hookType: string]: readonly IQuizChatHookCommand[];
}

/**
 * A single hook command registered for a chat request.
 * Aligned with vscode.ChatHookCommand.
 */
export interface IQuizChatHookCommand {
	readonly id: string;
	readonly name: string;
	readonly command: string;
	readonly type: QuizChatHookType;
	readonly cwd?: IQuizHookCommandCwd;
	readonly env?: Record<string, string>;
	readonly timeout?: number;
}

/**
 * URI-like cwd for hook commands.
 * In common/ layer we avoid importing vscode.Uri directly.
 */
export interface IQuizHookCommandCwd {
	readonly fsPath: string;
}

// #endregion

// #region Hook command result (aligned with Copilot's IHookCommandResult + HookCommandResultKind)

/**
 * Result kind for hook command execution.
 * Aligned with Copilot's HookCommandResultKind (platform/chat/common/hookExecutor.ts).
 *
 * - Success: exit code 0
 * - Error: exit code 2 (blocking error, shown to model)
 * - NonBlockingError: other non-zero exit codes (shown to user only)
 */
export const enum QuizHookCommandResultKind {
	Success = 1,
	Error = 2,
	NonBlockingError = 3,
}

/**
 * Result of executing a single hook command.
 * Aligned with Copilot's IHookCommandResult.
 */
export interface IQuizHookCommandResult {
	readonly kind: QuizHookCommandResultKind;
	/**
	 * For Success: stdout parsed as JSON if valid, otherwise as string.
	 * For errors: stderr content.
	 */
	readonly result: string | object;
	/**
	 * The normalized exit code.
	 * 0 = success, 2 = blocking error, other non-zero = non-blocking error.
	 */
	readonly exitCode?: number;
}

// #endregion

// #region Hook result (aligned with Copilot's HookResult / vscode.ChatHookResult)

/**
 * A processed hook result from the chat hook service.
 * Aligned with Copilot's HookResult (extension/intents/node/hookResultProcessor.ts)
 * and vscode.ChatHookResult.
 *
 * This is what executeHook returns after converting IHookCommandResult
 * via the _toHookResult method in ChatHookService.
 */
export interface IQuizHookResult {
	/** Discriminator for the result kind. */
	readonly resultKind: 'success' | 'error' | 'warning';
	/**
	 * If set (including empty string), the agent should abort.
	 * Empty string means "stop without message" (from continue: false).
	 */
	readonly stopReason?: string;
	/** Warning message shown to user (not to model). */
	readonly warningMessage?: string;
	/** The hook's structured output (parsed from stdout JSON). */
	readonly output: unknown;
}

// #endregion

// #region PreToolUse hook command types (aligned with Copilot's hookCommandTypes.ts)

/**
 * Input written to stdin for a PreToolUse hook command.
 * Aligned with Copilot's IPreToolUseHookCommandInput.
 */
export interface IQuizPreToolUseHookCommandInput {
	readonly tool_name: string;
	readonly tool_input: unknown;
	readonly tool_use_id: string;
}

/**
 * Hook-specific output fields returned by a PreToolUse hook command (inside hookSpecificOutput).
 * Aligned with Copilot's IPreToolUseHookSpecificCommandOutput.
 */
export interface IQuizPreToolUseHookSpecificCommandOutput {
	readonly hookEventName?: string;
	readonly permissionDecision?: 'allow' | 'deny' | 'ask';
	readonly permissionDecisionReason?: string;
	readonly updatedInput?: object;
	readonly additionalContext?: string;
}

// #endregion

// #region PostToolUse hook command types (aligned with Copilot's hookCommandTypes.ts)

/**
 * Input written to stdin for a PostToolUse hook command.
 * Aligned with Copilot's IPostToolUseHookCommandInput.
 */
export interface IQuizPostToolUseHookCommandInput {
	readonly tool_name: string;
	readonly tool_input: unknown;
	readonly tool_response: string;
	readonly tool_use_id: string;
}

/**
 * Hook-specific output fields returned by a PostToolUse hook command (inside hookSpecificOutput).
 * Aligned with Copilot's IPostToolUseHookSpecificCommandOutput.
 */
export interface IQuizPostToolUseHookSpecificCommandOutput {
	readonly hookEventName?: string;
	readonly additionalContext?: string;
}

// #endregion

// #region PreToolUse hook collapsed result (aligned with Copilot's IPreToolUseHookResult)

/**
 * Collapsed result from all preToolUse hooks.
 * Multiple hooks' decisions are collapsed: deny > ask > allow.
 * Aligned with Copilot's IPreToolUseHookResult (platform/chat/common/chatHookService.ts).
 */
export interface IQuizPreToolUseHookResult {
	permissionDecision?: 'allow' | 'deny' | 'ask';
	permissionDecisionReason?: string;
	updatedInput?: object;
	additionalContext?: string[];
}

// #endregion

// #region PostToolUse hook collapsed result (aligned with Copilot's IPostToolUseHookResult)

/**
 * Collapsed result from all postToolUse hooks.
 * Aligned with Copilot's IPostToolUseHookResult (platform/chat/common/chatHookService.ts).
 */
export interface IQuizPostToolUseHookResult {
	decision?: 'block';
	reason?: string;
	additionalContext?: string[];
}

// #endregion

// #region Hook input/output types (aligned with Copilot's chatHookService.ts)

// --- UserPromptSubmit ---

export interface IQuizUserPromptSubmitHookInput {
	readonly prompt: string;
}

export interface IQuizUserPromptSubmitHookOutput {
	readonly decision?: 'block';
	readonly reason?: string;
	readonly hookSpecificOutput?: {
		readonly hookEventName?: string;
		readonly additionalContext?: string;
	};
}

// --- SessionStart ---

export interface IQuizSessionStartHookInput {
	readonly source: 'new';
	readonly model: string;
	readonly agent_type?: string;
}

export interface IQuizSessionStartHookOutput {
	readonly hookSpecificOutput?: {
		readonly hookEventName?: string;
		readonly additionalContext?: string;
	};
}

// --- Stop ---

export interface IQuizStopHookInput {
	readonly stop_hook_active: boolean;
}

export interface IQuizStopHookOutput {
	readonly hookSpecificOutput?: {
		readonly hookEventName?: string;
		readonly decision?: 'block';
		readonly reason?: string;
	};
}

// --- SubagentStart ---

export interface IQuizSubagentStartHookInput {
	readonly agent_id: string;
	readonly agent_type: string;
}

export interface IQuizSubagentStartHookOutput {
	readonly hookSpecificOutput?: {
		readonly hookEventName?: string;
		readonly additionalContext?: string;
	};
}

// --- SubagentStop ---

export interface IQuizSubagentStopHookInput {
	readonly agent_id: string;
	readonly agent_type: string;
	readonly stop_hook_active: boolean;
}

export interface IQuizSubagentStopHookOutput {
	readonly hookSpecificOutput?: {
		readonly hookEventName?: string;
		readonly decision?: 'block';
		readonly reason?: string;
	};
}

// --- PreCompact ---

export interface IQuizPreCompactHookInput {
	readonly trigger: 'auto';
	readonly custom_instructions?: string;
}

// #endregion

// #region Hook result processing (aligned with Copilot's hookResultProcessor.ts)

/**
 * Options for processing hook results.
 * Aligned with Copilot's ProcessHookResultsOptions (extension/intents/node/hookResultProcessor.ts).
 */
export interface IQuizProcessHookResultsOptions {
	/** The type of hook being processed */
	hookType: string;
	/** The hook results to process */
	results: readonly IQuizHookResult[];
	/** The output stream for displaying messages */
	outputStream: IQuizHookOutputStream | undefined;
	/** The log service for logging */
	logService: ILogService;
	/** Callback for handling successful hook results. Called with the output for each success. */
	onSuccess: (output: unknown) => void;
	/**
	 * When true, errors and stopReason are completely ignored (no throw, no warning, no hookProgress).
	 * Use for hooks like SessionStart/SubagentStart where blocking errors should be silently ignored.
	 */
	ignoreErrors?: boolean;
	/**
	 * Callback for handling error results. When provided, errors are passed to this callback
	 * instead of being shown to the user. Use for Stop/SubagentStop hooks where errors
	 * should be collected as blocking reasons.
	 */
	onError?: (errorMessage: string) => void;
}

/**
 * Processes hook results, handling aborts, warnings, errors, and success cases.
 * Warnings are aggregated and displayed together via hookProgress after processing all results.
 *
 * Aligned with Copilot's processHookResults (extension/intents/node/hookResultProcessor.ts).
 *
 * @throws QuizHookAbortError if any result contains a stopReason or an error result is encountered
 */
export function processQuizHookResults(options: IQuizProcessHookResultsOptions): void {
	const { hookType, results, outputStream, logService, onSuccess, ignoreErrors, onError } = options;

	const warnings: string[] = [];

	for (const result of results) {
		// Check for stopReason - abort immediately (unless ignoreErrors is set)
		// Note: empty string is a valid stopReason (from continue: false without explicit message)
		if (result.stopReason !== undefined) {
			if (ignoreErrors) {
				logService.trace(`[QuizToolCallingLoop] ${hookType} hook stopReason ignored: ${result.stopReason}`);
				continue;
			}
			logService.info(`[QuizToolCallingLoop] ${hookType} hook requested abort: ${result.stopReason}`);
			outputStream?.hookProgress(hookType, formatQuizHookErrorMessage(result.stopReason));
			throw new QuizHookAbortError(hookType, result.stopReason);
		}

		// Collect warnings
		if (result.resultKind === 'warning' && result.warningMessage) {
			logService.trace(`[QuizToolCallingLoop] ${hookType} hook warning: ${result.warningMessage}`);
			warnings.push(result.warningMessage);
		}

		// Handle success
		if (result.resultKind === 'success') {
			if (result.warningMessage) {
				warnings.push(result.warningMessage);
			}
			onSuccess(result.output);
		}

		// Handle error - abort unless ignoreErrors is set or onError is provided
		if (result.resultKind === 'error') {
			const errorMessage = typeof result.output === 'string' && result.output ? result.output : '';
			logService.error(`[QuizToolCallingLoop] ${hookType} hook error: ${errorMessage}`);
			if (onError) {
				// Pass error to callback (for Stop/SubagentStop to collect as blocking reason)
				onError(errorMessage);
				continue;
			} else if (ignoreErrors) {
				// Completely ignore error - no throw, no hookProgress (silently continue)
				continue;
			} else {
				outputStream?.hookProgress(hookType, formatQuizHookErrorMessage(errorMessage));
				throw new QuizHookAbortError(hookType, errorMessage);
			}
		}
	}

	// Show aggregated warnings via hookProgress
	if (warnings.length > 0 && outputStream) {
		if (warnings.length === 1) {
			outputStream.hookProgress(hookType, undefined, warnings[0]);
		} else {
			const formattedWarnings = warnings.map((w, i) => `${i + 1}. ${w}`).join('\n');
			outputStream.hookProgress(hookType, undefined, formattedWarnings);
		}
	}
}

/**
 * Formats an error message for a failed hook.
 * Aligned with Copilot's formatHookErrorMessage (extension/intents/node/hookResultProcessor.ts).
 */
export function formatQuizHookErrorMessage(errorMessage: string): string {
	if (errorMessage) {
		return `A hook prevented chat from continuing. Please check the Quiz Chat Hooks output channel for more details.\nError message: ${errorMessage}`;
	}
	return 'A hook prevented chat from continuing. Please check the Quiz Chat Hooks output channel for more details.';
}

// #endregion

// #region Hook abort error (aligned with Copilot's HookAbortError)

/**
 * Error thrown when a hook requests the agent to abort processing.
 * The message should be shown to the user.
 * Aligned with Copilot's HookAbortError (extension/intents/node/hookResultProcessor.ts).
 */
export class QuizHookAbortError extends Error {
	constructor(
		public readonly hookType: string,
		public readonly stopReason: string,
	) {
		super(`Hook ${hookType} aborted: ${stopReason}`);
		this.name = 'QuizHookAbortError';
	}
}

export function isQuizHookAbortError(error: unknown): error is QuizHookAbortError {
	return error instanceof QuizHookAbortError;
}

// #endregion

// #region Compatible hook event names (aligned with Copilot's compatibleHookEventNames)

/**
 * One-way compatible hook event name mappings.
 * When a hook written for one event type is reused under a different type
 * (e.g. a Stop hook scoped to a custom agent runs as SubagentStop),
 * the hookEventName in the output won't match.
 *
 * Aligned with Copilot's compatibleHookEventNames (extension/chat/vscode-node/chatHookService.ts).
 */
const compatibleQuizHookEventNames: ReadonlyMap<string, string> = new Map([
	['Stop', 'SubagentStop'],
	['SessionStart', 'SubagentStart'],
]);

export function isCompatibleQuizHookEventName(hookEventName: string, hookType: string): boolean {
	return hookEventName === hookType || compatibleQuizHookEventNames.get(hookEventName) === hookType;
}

// #endregion

// #region Permission priority (aligned with Copilot's permissionPriority)

/**
 * Priority for collapsing PreToolUse hook decisions.
 * deny > ask > allow (most restrictive wins).
 * Aligned with Copilot's permissionPriority (extension/chat/vscode-node/chatHookService.ts).
 */
export const quizPermissionPriority: Record<string, number> = { 'deny': 2, 'ask': 1, 'allow': 0 };

// #endregion

// #region Null implementations

/**
 * Null implementation of IQuizChatHookService that returns no hook results.
 */
export class NullQuizChatHookService implements IQuizChatHookService {
	declare readonly _serviceBrand: undefined;

	logConfiguredHooks(_hooks: IQuizChatRequestHooks | undefined): void { /* no-op */ }

	async executeHook(_hookType: QuizChatHookType, _hooks: IQuizChatRequestHooks | undefined, _input: unknown, _sessionId?: string, _token?: CancellationToken): Promise<IQuizHookResult[]> {
		return [];
	}

	async executePreToolUseHook(_toolName: string, _toolInput: unknown, _toolCallId: string, _hooks: IQuizChatRequestHooks | undefined, _sessionId?: string, _token?: CancellationToken, _outputStream?: IQuizHookOutputStream): Promise<IQuizPreToolUseHookResult | undefined> {
		return undefined;
	}

	async executePostToolUseHook(_toolName: string, _toolInput: unknown, _toolResponseText: string, _toolCallId: string, _hooks: IQuizChatRequestHooks | undefined, _sessionId?: string, _token?: CancellationToken, _outputStream?: IQuizHookOutputStream): Promise<IQuizPostToolUseHookResult | undefined> {
		return undefined;
	}
}

/**
 * Null implementation of IQuizHookExecutor.
 */
export class NullQuizHookExecutor implements IQuizHookExecutor {
	declare readonly _serviceBrand: undefined;

	async executeCommand(_hookCommand: IQuizChatHookCommand, _input: unknown, _token: CancellationToken): Promise<IQuizHookCommandResult> {
		return { kind: QuizHookCommandResultKind.Success, result: '' };
	}
}

/**
 * Null implementation of IQuizHooksOutputChannel.
 */
export class NullQuizHooksOutputChannel implements IQuizHooksOutputChannel {
	declare readonly _serviceBrand: undefined;

	appendLine(_message: string): void { /* no-op */ }
}

// #endregion
