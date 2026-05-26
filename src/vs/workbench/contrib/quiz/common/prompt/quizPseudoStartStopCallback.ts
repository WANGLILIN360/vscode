/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/pseudoStartStopConversationCallback.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';

export interface IQuizStartStopMapping {
	readonly stop: string;
	readonly start?: string;
}

/**
 * Interface for response deltas received during streaming.
 * Simplified from Copilot's IResponseDelta.
 */
export interface IQuizResponseDelta {
	text?: string;
	thinking?: { id?: string; text?: string; metadata?: { [key: string]: unknown } };
	retryReason?: string;
	toolCalls?: readonly IQuizDeltaToolCall[];
	toolCallStreamUpdates?: readonly IQuizDeltaToolCallStreamUpdate[];
}

export interface IQuizDeltaToolCall {
	readonly id?: string;
	readonly name: string;
	readonly arguments: string;
}

export interface IQuizDeltaToolCallStreamUpdate {
	readonly id?: string;
	readonly name?: string;
	readonly arguments?: string;
}

/**
 * This IQuizResponseProcessor skips over text that is between a start and stop word
 * and processes it for output if applicable.
 */
export class QuizPseudoStopStartResponseProcessor {
	private stagedDeltasToApply: IQuizResponseDelta[] = [];
	private currentStartStop: IQuizStartStopMapping | undefined = undefined;
	private nonReportedDeltas: IQuizResponseDelta[] = [];

	private readonly _lastToolStreamUpdate = new Map<string, number>();
	private readonly _pendingToolStreamUpdates = new Map<string, { id: string; arguments: string | undefined }>();

	constructor(
		private readonly stopStartMappings: readonly IQuizStartStopMapping[],
		private readonly processNonReportedDelta: ((deltas: IQuizResponseDelta[]) => string[]) | undefined,
	) { }

	async processResponse(inputStream: AsyncIterable<IQuizResponsePart>, outputStream: IQuizResponseStream, token: CancellationToken): Promise<void> {
		return this.doProcessResponse(inputStream, outputStream, token);
	}

	async doProcessResponse(responseStream: AsyncIterable<IQuizResponsePart>, progress: IQuizResponseStream, token: CancellationToken): Promise<void> {
		try {
			for await (const { delta } of responseStream) {
				if (token.isCancellationRequested) {
					return;
				}
				this.applyDelta(delta, progress);
			}
		} finally {
			if (token.isCancellationRequested) {
				this._clearPendingToolStreamUpdates();
			} else {
				this._flushPendingToolStreamUpdates(progress);
			}
		}
	}

	private _clearPendingToolStreamUpdates(): void {
		this._pendingToolStreamUpdates.clear();
		this._lastToolStreamUpdate.clear();
	}

	private _flushPendingToolStreamUpdates(progress: IQuizResponseStream): void {
		// No-op in simplified version; consumers can override
		this._clearPendingToolStreamUpdates();
	}

	protected applyDeltaToProgress(delta: IQuizResponseDelta, progress: IQuizResponseStream) {
		if (delta.text) {
			progress.markdown(delta.text);
		}

		if (delta.toolCalls?.length) {
			for (const toolCall of delta.toolCalls) {
				// Report tool invocation start
				progress.toolInvocation?.(toolCall.id ?? '', toolCall.name, JSON.parse(toolCall.arguments));
			}
		}
	}

	/**
	 * Update the stagedDeltasToApply list: consume deltas up to `idx` and return them, and delete `length` after that
	 */
	private updateStagedDeltasUpToIndex(stopWordIdx: number, length: number): IQuizResponseDelta[] {
		const result: IQuizResponseDelta[] = [];
		for (let deltaOffset = 0; deltaOffset < stopWordIdx + length;) {
			const delta = this.stagedDeltasToApply.shift();
			if (delta) {
				const textLength = delta.text?.length ?? 0;
				if (deltaOffset + textLength <= stopWordIdx) {
					result.push(delta);
				} else if (deltaOffset < stopWordIdx || deltaOffset < stopWordIdx + length) {
					if (deltaOffset < stopWordIdx) {
						const prefixDelta = { ...delta };
						prefixDelta.text = delta.text?.substring(0, stopWordIdx - deltaOffset);
						result.push(prefixDelta);
					}

					const postfixDelta = { ...delta };
					postfixDelta.text = delta.text?.substring((stopWordIdx - deltaOffset) + length);
					if (postfixDelta.text) {
						this.stagedDeltasToApply.unshift(postfixDelta);
					}
				}

				deltaOffset += textLength;
			} else {
				break;
			}
		}

		return result;
	}

	protected checkForKeyWords(pseudoStopWords: string[], delta: IQuizResponseDelta, applyDeltaToProgress: (delta: IQuizResponseDelta) => void): string | undefined {
		const textDelta = this.stagedDeltasToApply.map(d => d.text ?? '').join('') + (delta.text ?? '');

		for (const pseudoStopWord of pseudoStopWords) {
			const stopWordIndex = textDelta.indexOf(pseudoStopWord);
			if (stopWordIndex === -1) {
				continue;
			}

			this.stagedDeltasToApply.push(delta);
			const deltasToReport = this.updateStagedDeltasUpToIndex(stopWordIndex, pseudoStopWord.length);
			deltasToReport.forEach(item => applyDeltaToProgress(item));

			return pseudoStopWord;
		}

		for (const pseudoStopWord of pseudoStopWords) {
			for (let i = pseudoStopWord.length - 1; i > 0; i--) {
				const partialStopWord = pseudoStopWord.substring(0, i);
				if (textDelta.endsWith(partialStopWord)) {
					this.stagedDeltasToApply = [...this.stagedDeltasToApply, delta];
					return;
				}
			}
		}

		[...this.stagedDeltasToApply, delta].forEach(item => {
			applyDeltaToProgress(item);
		});
		this.stagedDeltasToApply = [];

		return;
	}

	private postReportRecordProgress(delta: IQuizResponseDelta) {
		this.nonReportedDeltas.push(delta);
	}

	protected applyDelta(delta: IQuizResponseDelta, progress: IQuizResponseStream): void {
		if (delta.retryReason) {
			this.stagedDeltasToApply = [];
			this.currentStartStop = undefined;
			this.nonReportedDeltas = [];
			this._clearPendingToolStreamUpdates();
			return;
		}
		if (this.currentStartStop === undefined) {
			const stopWord = this.checkForKeyWords(this.stopStartMappings.map(e => e.stop), delta, delta => this.applyDeltaToProgress(delta, progress));
			if (stopWord) {
				this.currentStartStop = this.stopStartMappings.find(e => e.stop === stopWord);
			}
			return;
		} else {
			if (!this.currentStartStop.start) {
				return;
			}
			const startWord = this.checkForKeyWords([this.currentStartStop.start], delta, this.postReportRecordProgress.bind(this));
			if (startWord) {
				if (this.processNonReportedDelta) {
					const postProcessed = this.processNonReportedDelta(this.nonReportedDeltas);
					postProcessed.forEach((text) => this.applyDeltaToProgress({ text }, progress));
				}

				this.currentStartStop = undefined;
				if (this.stagedDeltasToApply.length > 0) {
					this.applyDelta({ text: '' }, progress);
				}
			}
		}
	}
}

/**
 * Simplified response part for Quiz streaming.
 */
export interface IQuizResponsePart {
	readonly delta: IQuizResponseDelta;
}

/**
 * Simplified response stream for Quiz.
 */
export interface IQuizResponseStream {
	markdown(value: string): void;
	progress(message: string): void;
	toolInvocation?(toolId: string, name: string, args: object): void;
}
