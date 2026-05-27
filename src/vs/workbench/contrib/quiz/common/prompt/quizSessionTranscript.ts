/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's session transcript system:
//   platform/chat/common/sessionTranscriptService.ts — ISessionTranscriptService + entry types
//   extension/chat/vscode-node/sessionTranscriptService.ts — Node implementation
//
// This file provides the common/ layer types for Quiz.
// Pure types — no DI, no platform API (common/ layer).

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../../base/common/uri.js';

// #region IQuizSessionTranscriptService (aligned with Copilot's ISessionTranscriptService)

export const IQuizSessionTranscriptService = createDecorator<IQuizSessionTranscriptService>('quizSessionTranscriptService');

/**
 * Service for recording session transcripts as JSONL files.
 * Aligned with Copilot's ISessionTranscriptService (platform/chat/common/sessionTranscriptService.ts).
 *
 * Each session gets a `<sessionId>.jsonl` file in the workspace storage.
 * Entries are buffered in memory and flushed to disk periodically or on demand.
 * Hook scripts can read the transcript file to understand the conversation context.
 */
export interface IQuizSessionTranscriptService {
	readonly _serviceBrand: undefined;

	/**
	 * Start tracking a new session. Creates the transcript file.
	 *
	 * If `history` is provided and no transcript file exists on disk yet,
	 * the historical turns are replayed into the transcript before the
	 * current turn begins. If a file already exists, history is ignored.
	 *
	 * Aligned with Copilot's ISessionTranscriptService.startSession.
	 */
	startSession(sessionId: string, context?: { cwd?: string }, history?: readonly IQuizHistoricalTurn[]): Promise<void>;

	/**
	 * Record the user's prompt message.
	 * Entries are buffered; call flush() to write to disk.
	 */
	logUserMessage(sessionId: string, content: string, attachments?: readonly unknown[]): void;

	/**
	 * Record the start of an assistant turn (one iteration of the tool calling loop).
	 * Entries are buffered; call flush() to write to disk.
	 */
	logAssistantTurnStart(sessionId: string, turnId: string): void;

	/**
	 * Record an assistant message containing text and/or tool call requests.
	 * Entries are buffered; call flush() to write to disk.
	 */
	logAssistantMessage(sessionId: string, content: string, toolRequests: readonly IQuizToolRequest[], reasoningText?: string): void;

	/**
	 * Record the start of a tool execution.
	 * Entries are buffered; call flush() to write to disk.
	 */
	logToolExecutionStart(sessionId: string, toolCallId: string, toolName: string, args: unknown): void;

	/**
	 * Record the completion of a tool execution.
	 * Entries are buffered; call flush() to write to disk.
	 */
	logToolExecutionComplete(sessionId: string, toolCallId: string, success: boolean, resultContent?: string): void;

	/**
	 * Record the end of an assistant turn.
	 * Entries are buffered; call flush() to write to disk.
	 */
	logAssistantTurnEnd(sessionId: string, turnId: string): void;

	/**
	 * Flush all buffered transcript entries for a session to disk.
	 * Safe to call multiple times; concurrent flushes are serialized.
	 */
	flush(sessionId: string): Promise<void>;

	/**
	 * Mark a session as ended. The transcript file is retained for lazy cleanup.
	 */
	endSession(sessionId: string): Promise<void>;

	/**
	 * Get the URI of the transcript file for a session, if one exists.
	 * Returns undefined if the session has no transcript.
	 */
	getTranscriptPath(sessionId: string): URI | undefined;

	/**
	 * Get the current number of lines in the transcript for a session.
	 * Returns undefined if the session is not active.
	 */
	getLineCount(sessionId: string): number | undefined;

	/**
	 * Remove transcript files for sessions that are no longer active,
	 * keeping at most `maxRetained` most-recent ended sessions.
	 */
	cleanupOldTranscripts(maxRetained?: number): Promise<void>;

	/**
	 * Check whether a URI is under the transcripts storage directory.
	 */
	isTranscriptUri(uri: URI): boolean;
}

// #endregion

// #region Transcript entry types (aligned with Copilot's TranscriptEntry types)

/**
 * Common fields shared by all transcript entries.
 * Aligned with Copilot's TranscriptEntryBase.
 */
interface IQuizTranscriptEntryBase {
	/** Entry type discriminator. */
	readonly type: string;
	/** Entry-specific data payload. */
	readonly data: unknown;
	/** Unique entry identifier. */
	readonly id: string;
	/** ISO 8601 timestamp of when this entry was created. */
	readonly timestamp: string;
	/** ID of the previous entry for ordering (null for first entry). */
	readonly parentId: string | null;
}

// --- session.start ---

export interface IQuizSessionStartData {
	readonly sessionId: string;
	readonly version: number;
	readonly producer: string;
	readonly quizVersion: string;
	readonly vscodeVersion: string;
	readonly startTime: string;
	readonly context?: {
		readonly cwd?: string;
	};
}

export interface IQuizSessionStartEntry extends IQuizTranscriptEntryBase {
	readonly type: 'session.start';
	readonly data: IQuizSessionStartData;
}

// --- user.message ---

export interface IQuizUserMessageData {
	readonly content: string;
	readonly attachments?: readonly unknown[];
}

export interface IQuizUserMessageEntry extends IQuizTranscriptEntryBase {
	readonly type: 'user.message';
	readonly data: IQuizUserMessageData;
}

// --- assistant.turn_start ---

export interface IQuizAssistantTurnStartData {
	readonly turnId: string;
}

export interface IQuizAssistantTurnStartEntry extends IQuizTranscriptEntryBase {
	readonly type: 'assistant.turn_start';
	readonly data: IQuizAssistantTurnStartData;
}

// --- assistant.message ---

export interface IQuizToolRequest {
	readonly toolCallId: string;
	readonly name: string;
	readonly arguments: string;
	readonly type: 'function';
}

export interface IQuizAssistantMessageData {
	readonly messageId: string;
	readonly content: string;
	readonly toolRequests: readonly IQuizToolRequest[];
	readonly reasoningText?: string;
}

export interface IQuizAssistantMessageEntry extends IQuizTranscriptEntryBase {
	readonly type: 'assistant.message';
	readonly data: IQuizAssistantMessageData;
}

// --- tool.execution_start ---

export interface IQuizToolExecutionStartData {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly arguments: unknown;
}

export interface IQuizToolExecutionStartEntry extends IQuizTranscriptEntryBase {
	readonly type: 'tool.execution_start';
	readonly data: IQuizToolExecutionStartData;
}

// --- tool.execution_complete ---

export interface IQuizToolExecutionCompleteData {
	readonly toolCallId: string;
	readonly success: boolean;
	readonly result?: {
		readonly content: string;
	};
}

export interface IQuizToolExecutionCompleteEntry extends IQuizTranscriptEntryBase {
	readonly type: 'tool.execution_complete';
	readonly data: IQuizToolExecutionCompleteData;
}

// --- assistant.turn_end ---

export interface IQuizAssistantTurnEndData {
	readonly turnId: string;
}

export interface IQuizAssistantTurnEndEntry extends IQuizTranscriptEntryBase {
	readonly type: 'assistant.turn_end';
	readonly data: IQuizAssistantTurnEndData;
}

// --- Union type ---

export type IQuizTranscriptEntry =
	| IQuizSessionStartEntry
	| IQuizUserMessageEntry
	| IQuizAssistantTurnStartEntry
	| IQuizAssistantMessageEntry
	| IQuizToolExecutionStartEntry
	| IQuizToolExecutionCompleteEntry
	| IQuizAssistantTurnEndEntry;

// #endregion

// #region Historical replay types (aligned with Copilot's IHistoricalTurn)

/**
 * A tool call from a historical round, used when replaying conversation
 * history into a transcript file.
 * Aligned with Copilot's IHistoricalToolCall.
 */
export interface IQuizHistoricalToolCall {
	readonly name: string;
	readonly arguments: string;
	readonly id: string;
}

/**
 * A single assistant round from conversation history.
 * Maps to a user.message → assistant.turn_start → assistant.message → assistant.turn_end
 * sequence in the transcript.
 * Aligned with Copilot's IHistoricalToolCallRound.
 */
export interface IQuizHistoricalToolCallRound {
	/** The assistant's text response for this round. */
	readonly response: string;
	/** Tool calls made by the assistant in this round. */
	readonly toolCalls: readonly IQuizHistoricalToolCall[];
	/** Optional reasoning / thinking text. */
	readonly reasoningText?: string;
	/** Epoch millis (Date.now()) when this round started, if known. */
	readonly timestamp?: number;
}

/**
 * A single turn from conversation history, containing the user message
 * and all assistant rounds that followed.
 * Aligned with Copilot's IHistoricalTurn.
 */
export interface IQuizHistoricalTurn {
	/** The user's prompt text for this turn. */
	readonly userMessage: string;
	/** Epoch millis (Date.now()) when this turn started. */
	readonly timestamp: number;
	/** The assistant rounds that occurred during this turn. */
	readonly rounds: readonly IQuizHistoricalToolCallRound[];
}

// #endregion

// #region Null implementation

/**
 * Null implementation of IQuizSessionTranscriptService.
 * Aligned with Copilot's NullSessionTranscriptService.
 */
export class NullQuizSessionTranscriptService implements IQuizSessionTranscriptService {
	declare readonly _serviceBrand: undefined;

	async startSession(): Promise<void> { }
	logUserMessage(): void { }
	logAssistantTurnStart(): void { }
	logAssistantMessage(): void { }
	logToolExecutionStart(): void { }
	logToolExecutionComplete(): void { }
	logAssistantTurnEnd(): void { }
	async flush(): Promise<void> { }
	async endSession(): Promise<void> { }
	getTranscriptPath(): URI | undefined { return undefined; }
	getLineCount(): number | undefined { return undefined; }
	async cleanupOldTranscripts(): Promise<void> { }
	isTranscriptUri(): boolean { return false; }
}

// #endregion
