/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizEndpoint, IQuizChatRequestOptions, IQuizResponseDelta, IQuizEndpointBody, IQuizEndpointInfo } from '../../common/endpoint/quizEndpoint.js';
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
	readonly supportedEditTools: readonly import('../../common/endpoint/quizEndpoint.js').QuizEndpointEditToolName[] | undefined = undefined;
	readonly modelMaxPromptTokens = 128000;
	readonly maxOutputTokens = 4096;
	readonly maxPromptImages: number | undefined = undefined;
	readonly isPremium: boolean | undefined = undefined;
	readonly multiplier: number | undefined = undefined;
	readonly restrictedToSkus: readonly string[] | undefined = undefined;
	readonly priceCategory: string | undefined = undefined;
	readonly isFallback = true;
	readonly tokenPricing: import('../../common/endpoint/quizEndpoint.js').IQuizEndpointTokenPricing | undefined = undefined;
	readonly customModel: Record<string, unknown> | undefined = undefined;
	readonly isExtensionContributed: boolean | undefined = undefined;
	readonly showInModelPicker = true;
	readonly degradationReason: string | undefined = undefined;
	readonly tokenizer = 'o200k_base';
	readonly urlOrRequestMetadata: string | import('../../common/endpoint/quizQAPIClient.js').QuizRequestMetadata | undefined = undefined;
	readonly apiType: 'chatCompletions' | 'responses' | 'messages' | undefined = undefined;
	readonly ownsAuthorization: boolean | undefined = undefined;

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
			isPremium: undefined, multiplier: undefined, restrictedToSkus: undefined,
			tokenPricing: undefined, priceCategory: undefined, isFallback: true,
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

	toEndpointInfo(): IQuizEndpointInfo {
		return {
			modelId: this.modelId, name: this.name, version: this.version, family: this.family,
			vendor: this.vendor, modelProvider: this.modelProvider,
			supportsToolCalls: this.supportsToolCalls, supportsVision: this.supportsVision,
			supportsPrediction: this.supportsPrediction, supportsThinkingContentInHistory: this.supportsThinkingContentInHistory,
			supportsAdaptiveThinking: this.supportsAdaptiveThinking, minThinkingBudget: this.minThinkingBudget,
			maxThinkingBudget: this.maxThinkingBudget, supportsReasoningEffort: this.supportsReasoningEffort,
			supportsToolSearch: this.supportsToolSearch, supportsContextEditing: this.supportsContextEditing,
			supportedEditTools: this.supportedEditTools,
			modelMaxPromptTokens: this.modelMaxPromptTokens, maxOutputTokens: this.maxOutputTokens,
			maxPromptImages: this.maxPromptImages, isPremium: this.isPremium, multiplier: this.multiplier,
			restrictedToSkus: this.restrictedToSkus, priceCategory: this.priceCategory,
			isFallback: this.isFallback, tokenPricing: this.tokenPricing,
			customModel: this.customModel, isExtensionContributed: this.isExtensionContributed,
			showInModelPicker: this.showInModelPicker, degradationReason: this.degradationReason,
			urlOrRequestMetadata: this.urlOrRequestMetadata, apiType: this.apiType,
			ownsAuthorization: this.ownsAuthorization,
			tokenizer: this.tokenizer,
			isAvailable: this.isAvailable(),
		};
	}
}
