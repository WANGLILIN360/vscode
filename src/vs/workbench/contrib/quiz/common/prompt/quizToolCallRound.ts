/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuizToolCall, IQuizToolCallRound, IQuizThinkingData, IQuizThinkingDelta, IQuizContextManagementResponse, isQuizEncryptedThinkingDelta } from '../intents/quizIntents.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

// #region QuizThinkingDataItem (aligned with Copilot's ThinkingDataItem)

/**
 * Mutable accumulator for thinking data during streaming.
 * Incrementally updates as thinking deltas arrive from the model.
 */
export class QuizThinkingDataItem implements IQuizThinkingData {
	public text: string | string[] = '';
	public metadata?: { [key: string]: unknown };
	public tokens?: number;
	public encrypted?: string;

	static createOrUpdate(item: QuizThinkingDataItem | undefined, delta: IQuizThinkingDelta): QuizThinkingDataItem {
		if (!item) {
			item = new QuizThinkingDataItem(delta.id ?? generateUuid());
		}
		item.update(delta);
		return item;
	}

	constructor(
		public id: string,
	) { }

	update(delta: IQuizThinkingDelta): void {
		if (delta.id && this.id !== delta.id) {
			this.id = delta.id;
		}
		if (isQuizEncryptedThinkingDelta(delta)) {
			this.encrypted = delta.encrypted;
		}
		if (delta.text !== undefined) {
			if (Array.isArray(delta.text)) {
				if (Array.isArray(this.text)) {
					this.text.push(...delta.text);
				} else if (this.text) {
					this.text = [this.text, ...delta.text];
				} else {
					this.text = [...delta.text];
				}
			} else {
				if (Array.isArray(this.text)) {
					this.text.push(delta.text);
				} else {
					this.text += delta.text;
				}
			}
		}
		if (delta.metadata) {
			this.metadata = delta.metadata;
		}
	}

	updateWithTokenUsage(promptTokens: number, outputTokens: number): void {
		this.tokens = outputTokens;
	}

	updateWithFetchResult(fetchResult: { usage?: { completion_tokens_details?: { reasoning_tokens?: number } } }): void {
		this.tokens = fetchResult.usage?.completion_tokens_details?.reasoning_tokens;
	}
}

// #endregion

// #region QuizToolCallRound (aligned with Copilot's ToolCallRound)

/**
 * Full implementation of a tool call round with mutable summary, phase, and modelId.
 * Extends the IQuizToolCallRound interface with additional fields for thinking data
 * and Responses API context management.
 */
export class QuizToolCallRound implements IQuizToolCallRound {
	public summary: string | undefined;
	public phase?: string;
	public modelId?: string;

	/**
	 * Creates a QuizToolCallRound from an existing IQuizToolCallRound object.
	 */
	public static create(params: Omit<IQuizToolCallRound, 'id'> & {
		id?: string;
	}): QuizToolCallRound {
		const round = new QuizToolCallRound(
			params.response,
			params.toolCalls,
			params.toolInputRetry,
			params.id,
			params.statefulMarker,
			params.thinking,
			params.timestamp,
			params.compaction,
		);
		round.summary = params.summary;
		round.phase = params.phase;
		round.modelId = params.modelId;
		return round;
	}

	constructor(
		public readonly response: string,
		public readonly toolCalls: IQuizToolCall[] = [],
		public readonly toolInputRetry: number = 0,
		public readonly id: string = generateUuid(),
		public readonly statefulMarker?: string,
		public readonly thinking?: IQuizThinkingData,
		public readonly timestamp: number = Date.now(),
		public readonly compaction?: IQuizContextManagementResponse,
	) { }
}

// #endregion

// IQuizContextManagementResponse is defined in quizIntents.ts (type definition layer)

// #region QuizToolResultMetadata (aligned with Copilot's ToolResultMetadata)

/**
 * Metadata about a tool result, including timing, error info, and hook decisions.
 * Aligned with Copilot's ToolResultMetadata (extension/intents/node/toolCallingLoop.ts).
 */
export interface IQuizToolResultMetadata {
	/** The tool call ID this metadata belongs to */
	readonly toolCallId: string;
	/** The tool name */
	readonly toolName: string;
	/** Whether the tool execution was denied by a hook */
	readonly deniedByHook?: boolean;
	/** Whether the tool result was blocked by a post-tool-use hook */
	readonly blockedByHook?: boolean;
	/** Duration of tool execution in milliseconds */
	readonly durationMs?: number;
	/** Whether the tool execution resulted in an error */
	readonly isError?: boolean;
	/** The permission decision from the pre-tool-use hook */
	readonly permissionDecision?: 'allow' | 'deny';
	/** The permission decision reason from the hook */
	readonly permissionDecisionReason?: string;
}

// #endregion
