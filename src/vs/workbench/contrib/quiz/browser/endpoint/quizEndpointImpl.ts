/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizEndpoint, IQuizChatRequestOptions, IQuizResponseDelta, IQuizEndpointBody } from '../../common/endpoint/quizEndpoint.js';
import { IQuizModelCapabilities } from '../../common/endpoint/quizModelCapabilities.js';
import { IQuizPromptMessage } from '../../common/intents/quizIntents.js';

/**
 * @deprecated Use QuizLanguageModelEndpoint from quizEndpointProviderImpl.ts instead,
 * which bridges ILanguageModelsService for real model API access.
 */
export class QuizEndpointImpl implements IQuizEndpoint {

	private readonly _onDidChangeAvailability = new Emitter<boolean>();
	readonly onDidChangeAvailability = this._onDidChangeAvailability.event;

	constructor(
		private readonly _endpointUrl: string,
		@ILogService private readonly _logService: ILogService,
	) { }

	readonly modelId = 'stub';
	readonly name = 'stub-endpoint';
	readonly version = '0';
	readonly family = '';
	readonly vendor = 'stub';
	readonly modelProvider = 'stub';
	readonly supportsToolCalls = false;
	readonly supportsVision = false;
	readonly supportsPrediction = false;
	readonly supportsThinkingContentInHistory = false;
	readonly supportsAdaptiveThinking = false;
	readonly minThinkingBudget: number | undefined = undefined;
	readonly maxThinkingBudget: number | undefined = undefined;
	readonly supportsReasoningEffort: readonly string[] | undefined = undefined;
	readonly supportsToolSearch = false;
	readonly supportsContextEditing = false;
	readonly supportedEditTools: readonly string[] | undefined = undefined;
	readonly modelMaxPromptTokens = 128000;
	readonly maxOutputTokens = 4096;
	readonly maxPromptImages: number | undefined = undefined;
	readonly isPremium: boolean | undefined = undefined;
	readonly priceCategory: string | undefined = undefined;
	readonly isFallback = true;

	isAvailable(): boolean {
		return !!this._endpointUrl;
	}

	getCapabilities(): IQuizModelCapabilities {
		return {
			modelId: this.modelId, vendor: this.vendor, family: this.family, version: this.version,
			supportsToolCalls: false, supportsVision: false, supportsAgentMode: false,
			supportsPrediction: false, supportsThinkingContentInHistory: false, supportsAdaptiveThinking: false,
			minThinkingBudget: undefined, maxThinkingBudget: undefined, supportsReasoningEffort: undefined,
			supportsToolSearch: false, supportsContextEditing: false,
			maxOutputTokens: 4096, maxInputTokens: 128000, maxPromptImages: undefined,
			supportedEditTools: undefined, tokenizerType: 4 as import('../../common/quizTypes.js').QuizTokenizerType,
			isPremium: undefined, priceCategory: undefined, isFallback: true,
		} satisfies IQuizModelCapabilities;
	}

	async *sendChatRequest(
		messages: readonly IQuizPromptMessage[],
		options: IQuizChatRequestOptions,
		token: CancellationToken,
	): AsyncIterable<IQuizResponseDelta> {
		this._logService.info(`[QuizEndpoint] Sending request with ${messages.length} messages`);

		// TODO: Replace with actual fetch/SSE implementation
		yield { text: '[Endpoint stub - replace with real implementation]' };
	}

	async computeTokenCount(message: string, _token: CancellationToken): Promise<number> {
		return Math.ceil(message.length / 4);
	}

	createRequestBody(_messages: readonly IQuizPromptMessage[], _options: IQuizChatRequestOptions): IQuizEndpointBody {
		return { model: this.modelId, stream: true };
	}
}
