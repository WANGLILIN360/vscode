/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's cache breakpoint system:
//   extension/intents/node/cacheBreakpoints.ts — addCacheBreakpoints
//   platform/endpoint/common/endpointTypes.ts   — CacheType constant
//
// This file provides the common/ layer types for Quiz.
// Pure types + pure functions (common/ layer).

import { IQuizPromptMessage, QuizPromptMessageRole } from '../intents/quizIntents.js';
import { QuizCacheType } from '../endpoint/quizEndpoint.js';

// #region Cache breakpoint constants (aligned with Copilot's MaxCacheBreakpoints / CacheType)

/**
 * Maximum number of cache breakpoints that can be added to a prompt.
 * Anthropic allows up to 4 cache breakpoints per request.
 * Aligned with Copilot's MaxCacheBreakpoints.
 */
export const QuizMaxCacheBreakpoints = 4;

// #endregion

// #region Cache breakpoint annotation (aligned with Copilot's CacheBreakpoint content part)

/**
 * Annotation that marks a position in the prompt for caching.
 * When sent to Anthropic models, this enables prompt caching —
 * the model can reuse previously computed KV cache up to this point.
 *
 * Aligned with Copilot's CacheBreakpoint content part
 * (Raw.ChatCompletionContentPartKind.CacheBreakpoint).
 */
export interface IQuizCacheBreakpointAnnotation {
	readonly type: 'cache_breakpoint';
	readonly cacheType: string;
}

// #endregion

// #region Cache breakpoint message (aligned with Copilot's cache breakpoint message shape)

/**
 * A prompt message that may carry cache breakpoint annotations.
 * Used internally by addQuizCacheBreakpoints to annotate messages.
 */
export interface IQuizCacheAnnotatedMessage extends IQuizPromptMessage {
	/** Cache breakpoint annotations added to this message */
	cacheAnnotations?: IQuizCacheBreakpointAnnotation[];
}

// #endregion

// #region addQuizCacheBreakpoints (aligned with Copilot's addCacheBreakpoints)

/**
 * Prompt cache breakpoint strategy:
 *
 * The prompt is structured like:
 * - System message
 * - Custom instructions
 * - Global context message (has cache breakpoint)
 * - History
 * - Current user message with extra context
 * - Current tool call rounds
 *
 * Below the current user message, we add cache breakpoints to the last tool result
 * in each round. We add one to the current user message. Above the current user
 * message, we add breakpoints to an assistant message with no tool calls
 * (the terminal response in a turn).
 *
 * There will always be a cache miss when a new turn starts because the previous
 * messages move from below the current user message to above it.
 * For turns with no tool calling, we will have a hit on the previous assistant
 * message in history. During the agentic loop, each request will have a hit on
 * the previous tool result message.
 *
 * Aligned with Copilot's addCacheBreakpoints (extension/intents/node/cacheBreakpoints.ts).
 *
 * @param messages The prompt messages to annotate with cache breakpoints.
 *   These messages are mutated in place (annotations are added).
 */
export function addQuizCacheBreakpoints(messages: IQuizCacheAnnotatedMessage[]): void {
	// One or two cache breakpoints are already added via the prompt, assign the rest here.
	let count = QuizMaxCacheBreakpoints - countQuizCacheBreakpoints(messages);
	let isBelowCurrentUserMessage = true;
	const reversedMsgs = [...messages].reverse();
	for (const [idx, msg] of reversedMsgs.entries()) {
		const prevMsg = reversedMsgs.at(idx - 1);
		const hasCacheBreakpoint = msg.cacheAnnotations?.some(a => a.type === 'cache_breakpoint') ?? false;
		if (hasCacheBreakpoint) {
			continue;
		}

		const isLastToolResultInRound = msg.role === QuizPromptMessageRole.Tool && prevMsg?.role !== QuizPromptMessageRole.Tool;
		const isAsstMsgWithNoTools = msg.role === QuizPromptMessageRole.Assistant && !msg.toolCalls?.length;
		if ((isBelowCurrentUserMessage && (isLastToolResultInRound || msg.role === QuizPromptMessageRole.User)) || isAsstMsgWithNoTools) {
			count--;
			if (!msg.cacheAnnotations) {
				(msg as { cacheAnnotations?: IQuizCacheBreakpointAnnotation[] }).cacheAnnotations = [];
			}
			msg.cacheAnnotations!.push({
				type: 'cache_breakpoint',
				cacheType: QuizCacheType,
			});

			if (count <= 0) {
				break;
			}
		}

		if (msg.role === QuizPromptMessageRole.User) {
			isBelowCurrentUserMessage = false;
		}
	}

	// If we still have cache breakpoints to allocate, add them from the system
	// and custom instructions messages, if applicable.
	for (const msg of messages) {
		if (count <= 0) {
			break;
		}

		const hasCacheBreakpoint = msg.cacheAnnotations?.some(a => a.type === 'cache_breakpoint') ?? false;
		if ((msg.role === QuizPromptMessageRole.User || msg.role === QuizPromptMessageRole.System) && !hasCacheBreakpoint) {
			count--;
			if (!msg.cacheAnnotations) {
				(msg as { cacheAnnotations?: IQuizCacheBreakpointAnnotation[] }).cacheAnnotations = [];
			}
			msg.cacheAnnotations!.push({
				type: 'cache_breakpoint',
				cacheType: QuizCacheType,
			});
		}

		if (msg.role !== QuizPromptMessageRole.User && msg.role !== QuizPromptMessageRole.System) {
			break;
		}
	}
}

/**
 * Count existing cache breakpoints in a set of messages.
 * Aligned with Copilot's countCacheBreakpoints.
 */
export function countQuizCacheBreakpoints(messages: IQuizCacheAnnotatedMessage[]): number {
	let count = 0;
	for (const msg of messages) {
		count += msg.cacheAnnotations?.filter(a => a.type === 'cache_breakpoint').length ?? 0;
	}
	return count;
}

// #endregion
