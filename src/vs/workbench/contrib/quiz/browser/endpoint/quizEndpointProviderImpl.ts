/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ILanguageModelsService, IChatMessage, ChatMessageRole, IChatMessageTextPart, IChatMessageToolResultPart, IChatMessageImagePart, IChatResponsePart, IChatResponseTextPart, IChatResponseToolUsePart, IChatResponseThinkingPart, ILanguageModelChatMetadata, ILanguageModelChatSelector } from '../../../chat/common/languageModels.js';
import { IQuizEndpoint, IQuizEndpointProvider, IQuizChatRequestOptions, IQuizEndpointBody, IQuizResponseDelta, IQuizEndpointInfo, IQuizEndpointTokenPricing, QuizModelSupportedEndpoint, IQuizEmbeddingsEndpoint, QuizEmbeddingsEndpointFamily } from '../../common/endpoint/quizEndpoint.js';
import { IQuizIntentEndpoint, IQuizPromptMessage, IQuizToolCall, IQuizThinkingDelta } from '../../common/intents/quizIntents.js';
import { QuizModelCapabilities, IQuizModelCapabilities, IQuizModelCapabilityOverride } from '../../common/endpoint/quizModelCapabilities.js';
import { QuizRequestType, type QuizRequestMetadata } from '../../common/endpoint/quizQAPIClient.js';
import { IQuizNetworkService } from '../../common/endpoint/quizNetwork.js';
import { BYOKQuizEndpoint, AnthropicQuizEndpoint, ExtensionContributedQuizEndpoint } from './quizEndpointSubclasses.js';

// #region QuizEndpointProvider (aligned with Copilot's IEndpointProvider)

export const QUIZ_DEFAULT_MODEL_SELECTOR: ILanguageModelChatSelector = { vendor: 'copilot' };

export class QuizEndpointProviderImpl extends Disposable implements IQuizEndpointProvider {

	declare readonly _serviceBrand: undefined;

	private readonly _endpoints = new Map<string, QuizLanguageModelEndpoint>();
	private readonly _onDidChangeModels = new Emitter<void>();
	readonly onDidChangeModels = this._onDidChangeModels.event;

	constructor(
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
		@IQuizNetworkService private readonly _networkService: IQuizNetworkService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._register(this._languageModelsService.onDidChangeLanguageModels(() => {
			this._endpoints.clear();
			this._onDidChangeModels.fire();
		}));
	}

	getEndpoint(modelId: string): IQuizEndpoint | undefined {
		let endpoint = this._endpoints.get(modelId);
		if (!endpoint) {
			const metadata = this._languageModelsService.lookupLanguageModel(modelId);
			if (!metadata) {
				this._logService.warn(`[QuizEndpointProvider] No model found for id: ${modelId}`);
				return undefined;
			}
			endpoint = this._createEndpoint(modelId, metadata);
			this._endpoints.set(modelId, endpoint);
		}
		return endpoint;
	}

	/**
	 * Create the appropriate endpoint subclass based on model metadata.
	 * Aligned with Copilot's endpoint creation logic:
	 * - Anthropic family → AnthropicQuizEndpoint (Messages API + anthropic-beta headers)
	 * - BYOK (non-copilot vendor with URL) → BYOKQuizEndpoint (ownsAuthorization)
	 * - Extension-contributed → ExtensionContributedQuizEndpoint (ILanguageModelsService only)
	 * - Default (Copilot models) → QuizLanguageModelEndpoint (CAPI path)
	 */
	private _createEndpoint(modelId: string, metadata: ILanguageModelChatMetadata): QuizLanguageModelEndpoint {
		const family = (metadata.family ?? '').toLowerCase();
		const vendor = (metadata.vendor ?? '').toLowerCase();

		// Check if this is a BYOK model (non-copilot vendor with a custom URL)
		// Aligned with Copilot's OpenAIEndpoint detection
		const isBYOK = this._isBYOKModel(vendor, metadata);

		// Check if this is an Anthropic model
		const isAnthropic = this._isAnthropicFamily(family, vendor);

		// Check if this is an extension-contributed model
		const isExtensionContributed = this._isExtensionContributedModel(vendor);

		if (isBYOK) {
			const apiKey = (metadata as Record<string, unknown>).apiKey as string ?? '';
			const modelUrl = (metadata as Record<string, unknown>).modelUrl as string ?? '';
			if (apiKey && modelUrl) {
				this._logService.debug(`[QuizEndpointProvider] Creating BYOKQuizEndpoint for ${modelId}`);
				return new BYOKQuizEndpoint(modelId, metadata, apiKey, modelUrl, this._languageModelsService, this._logService, this._networkService);
			}
			// Fall through to extension-contributed if no URL/key
			this._logService.warn(`[QuizEndpointProvider] BYOK model ${modelId} missing apiKey or modelUrl, falling back to extension-contributed`);
		}

		if (isAnthropic) {
			this._logService.debug(`[QuizEndpointProvider] Creating AnthropicQuizEndpoint for ${modelId}`);
			return new AnthropicQuizEndpoint(modelId, metadata, this._languageModelsService, this._logService, this._networkService);
		}

		if (isExtensionContributed) {
			this._logService.debug(`[QuizEndpointProvider] Creating ExtensionContributedQuizEndpoint for ${modelId}`);
			return new ExtensionContributedQuizEndpoint(modelId, metadata, this._languageModelsService, this._logService);
		}

		// Default: Copilot model that uses CAPI path
		this._logService.debug(`[QuizEndpointProvider] Creating QuizLanguageModelEndpoint for ${modelId}`);
		return new QuizLanguageModelEndpoint(modelId, metadata, this._languageModelsService, this._logService, this._networkService);
	}

	/**
	 * Check if a model is a BYOK (Bring Your Own Key) model.
	 * Aligned with Copilot's isBYOKModel() from byok/node/openAIEndpoint.ts.
	 */
	private _isBYOKModel(vendor: string, metadata: ILanguageModelChatMetadata): boolean {
		// BYOK models are non-copilot vendors with custom URLs
		if (vendor === 'copilot') {
			return false;
		}
		// Check for custom model URL in metadata
		const hasCustomUrl = !!(metadata as Record<string, unknown>).modelUrl;
		return hasCustomUrl;
	}

	/**
	 * Check if a model belongs to the Anthropic family.
	 * Aligned with Copilot's isAnthropicFamily() detection.
	 */
	private _isAnthropicFamily(family: string, vendor: string): boolean {
		return family.startsWith('claude') || vendor === 'anthropic';
	}

	/**
	 * Check if a model is extension-contributed (not from Copilot or BYOK).
	 * Aligned with Copilot's ExtensionContributedChatEndpoint detection.
	 */
	private _isExtensionContributedModel(vendor: string): boolean {
		// Extension-contributed models have non-copilot, non-anthropic vendors
		// and don't have a custom URL (they use ILanguageModelsService directly)
		return vendor !== 'copilot' && vendor !== 'anthropic';
	}

	async getDefaultEndpoint(): Promise<IQuizEndpoint | undefined> {
		const modelIds = await this._languageModelsService.selectLanguageModels(QUIZ_DEFAULT_MODEL_SELECTOR);
		if (modelIds.length === 0) {
			this._logService.warn('[QuizEndpointProvider] No models available for default selector');
			return undefined;
		}
		return this.getEndpoint(modelIds[0]);
	}

	async getAllModels(): Promise<readonly IQuizEndpointInfo[]> {
		const modelIds = await this._languageModelsService.selectLanguageModels({});
		const models: IQuizEndpointInfo[] = [];
		for (const modelId of modelIds) {
			const endpoint = this.getEndpoint(modelId);
			if (endpoint) {
				models.push(endpoint.toEndpointInfo());
			}
		}
		return models;
	}

	async getAllEndpoints(): Promise<readonly IQuizEndpoint[]> {
		const modelIds = await this._languageModelsService.selectLanguageModels({});
		const endpoints: IQuizEndpoint[] = [];
		for (const modelId of modelIds) {
			const endpoint = this.getEndpoint(modelId);
			if (endpoint) {
				endpoints.push(endpoint);
			}
		}
		return endpoints;
	}

	async getEndpointsByFamily(family: string): Promise<readonly IQuizEndpoint[]> {
		const allEndpoints = await this.getAllEndpoints();
		return allEndpoints.filter(e => e.family === family);
	}

	async getUtilityEndpoint(): Promise<IQuizEndpoint | undefined> {
		// Try to find a lightweight/utility model (aligned with Copilot's copilot-utility)
		// Prefer smaller models like GPT-4o-mini or Claude Haiku for utility tasks
		const allEndpoints = await this.getAllEndpoints();
		const utilityEndpoint = allEndpoints.find(e => e.isFallback);
		if (utilityEndpoint) {
			return utilityEndpoint;
		}
		// Fallback: return the first available endpoint
		return allEndpoints[0];
	}

	async getEmbeddingsEndpoint(_family?: QuizEmbeddingsEndpointFamily): Promise<IQuizEmbeddingsEndpoint | undefined> {
		// TODO: Implement embeddings endpoint resolution aligned with Copilot's
		// EndpointProvider.getEmbeddingsEndpoint(). This will route through
		// IQuizEmbeddingsService or IQuizQAPIClientService to obtain the
		// embeddings model endpoint info (name, version, family, tokenizer, maxBatchSize).
		// Interface alignment is complete; implementation will be added later.
		return undefined;
	}

	async getIntentEndpoint(modelId?: string): Promise<IQuizIntentEndpoint | undefined> {
		const resolvedId = modelId ?? (await this._languageModelsService.selectLanguageModels(QUIZ_DEFAULT_MODEL_SELECTOR))[0];
		if (!resolvedId) {
			this._logService.warn('[QuizEndpointProvider] No model available for intent endpoint');
			return undefined;
		}
		const metadata = this._languageModelsService.lookupLanguageModel(resolvedId);
		if (!metadata) {
			this._logService.warn(`[QuizEndpointProvider] No metadata for model: ${resolvedId}`);
			return undefined;
		}
		return createQuizIntentEndpoint(resolvedId, metadata);
	}

	override dispose(): void {
		super.dispose();
		for (const endpoint of this._endpoints.values()) {
			endpoint.dispose();
		}
		this._endpoints.clear();
		this._onDidChangeModels.dispose();
	}
}

// #endregion

// #region QuizLanguageModelEndpoint (aligned with Copilot's ChatEndpoint)

/**
 * An IQuizEndpoint backed by VS Code's ILanguageModelsService.
 * Converts between Quiz's IQuizPromptMessage and VS Code's IChatMessage formats.
 *
 * Aligned with Copilot's ChatEndpoint (from platform/networking/common/networking.ts),
 * but bridges ILanguageModelsService instead of doing raw HTTP.
 * Provides full model capabilities, token budgeting, and request body construction.
 */
export class QuizLanguageModelEndpoint extends Disposable implements IQuizEndpoint {

	private readonly _onDidChangeAvailability = new Emitter<boolean>();
	readonly onDidChangeAvailability = this._onDidChangeAvailability.event;

	private readonly _capabilities: QuizModelCapabilities;
	// @ts-expect-error - unused but kept for future use
	private readonly _capabilityOverrides?: Record<string, IQuizModelCapabilityOverride>;

	constructor(
		public readonly modelId: string,
		public readonly modelMetadata: ILanguageModelChatMetadata,
		private readonly _languageModelsService: ILanguageModelsService,
		private readonly _logService: ILogService,
		private readonly _networkService?: IQuizNetworkService,
		capabilityOverrides?: Record<string, IQuizModelCapabilityOverride>,
	) {
		super();
		this._capabilityOverrides = capabilityOverrides;
		this._capabilities = QuizModelCapabilities.fromMetadata(modelId, modelMetadata, capabilityOverrides);
	}

	// --- Identity (aligned with Copilot's IEndpoint + IChatEndpoint)

	get name(): string { return this.modelMetadata.name; }
	get version(): string { return this.modelMetadata.version; }
	get family(): string { return this._capabilities.family; }
	get vendor(): string { return this.modelMetadata.vendor; }
	get modelProvider(): string { return this.modelMetadata.vendor; }
	/** Tokenizer type derived from capabilities (aligned with Copilot's IEndpoint.tokenizer) */
	get tokenizer(): string {
		switch (this._capabilities.tokenizerType) {
			case 1: return 'o200k_base';
			case 2: return 'cl100k_base';
			case 3: return 'anthropic';
			default: return 'char-level';
		}
	}

	// --- Capabilities (aligned with Copilot's IChatEndpoint capabilities)

	get supportsToolCalls(): boolean { return this._capabilities.supportsToolCalls; }
	get supportsVision(): boolean { return this._capabilities.supportsVision; }
	get supportsPrediction(): boolean { return this._capabilities.supportsPrediction; }
	get supportsThinkingContentInHistory(): boolean { return this._capabilities.supportsThinkingContentInHistory; }
	get supportsAdaptiveThinking(): boolean { return this._capabilities.supportsAdaptiveThinking; }
	get minThinkingBudget(): number | undefined { return this._capabilities.minThinkingBudget; }
	get maxThinkingBudget(): number | undefined { return this._capabilities.maxThinkingBudget; }
	get supportsReasoningEffort(): readonly string[] | undefined { return this._capabilities.supportsReasoningEffort; }
	get supportsToolSearch(): boolean { return this._capabilities.supportsToolSearch; }
	get supportsContextEditing(): boolean { return this._capabilities.supportsContextEditing; }
	get supportedEditTools(): readonly import('../../common/endpoint/quizEndpoint.js').QuizEndpointEditToolName[] | undefined { return this._capabilities.supportedEditTools; }

	// --- Token limits (aligned with Copilot's IEndpoint.modelMaxPromptTokens + IChatEndpoint.maxOutputTokens)

	get modelMaxPromptTokens(): number { return this._capabilities.maxInputTokens; }
	get maxOutputTokens(): number { return this._capabilities.maxOutputTokens; }
	get maxPromptImages(): number | undefined { return this._capabilities.maxPromptImages; }

	// --- Pricing (aligned with Copilot's IChatEndpointTokenPricing)

	get isPremium(): boolean | undefined { return this._capabilities.isPremium; }
	get multiplier(): number | undefined { return this._capabilities.multiplier; }
	get restrictedToSkus(): readonly string[] | undefined { return this._capabilities.restrictedToSkus; }
	get priceCategory(): string | undefined { return this._capabilities.priceCategory; }
	get isFallback(): boolean { return this._capabilities.isFallback; }
	get tokenPricing(): IQuizEndpointTokenPricing | undefined { return this._capabilities.tokenPricing; }
	get customModel(): Record<string, unknown> | undefined { return (this.modelMetadata as Record<string, unknown>).custom_model as Record<string, unknown> | undefined; }
	get isExtensionContributed(): boolean | undefined { return (this.modelMetadata as Record<string, unknown>).isExtensionContributed as boolean | undefined; }

	// --- UI / UX (aligned with Copilot's IChatEndpoint)

	get showInModelPicker(): boolean { return (this.modelMetadata as Record<string, unknown>).model_picker_enabled !== false; }
	get degradationReason(): string | undefined {
		// Aligned with Copilot's ChatEndpoint.degradationReason getter
		const warningMessages = (this.modelMetadata as Record<string, unknown>).warning_messages as Array<{ code: string; message: string }> | undefined;
		const infoMessages = (this.modelMetadata as Record<string, unknown>).info_messages as Array<{ code: string; message: string }> | undefined;
		return warningMessages?.at(0)?.message ?? infoMessages?.at(0)?.message;
	}

	// --- Network routing (aligned with Copilot's endpoint.urlOrRequestMetadata)

	/**
	 * When undefined (default), sendChatRequest uses ILanguageModelsService internally.
	 * When set to a string URL, routes through IQuizFetcherService (BYOK, xtab).
	 * When set to QuizRequestMetadata, routes through IQuizQAPIClientService (CAPI SDK).
	 *
	 * Aligned with Copilot's ChatEndpoint.urlOrRequestMetadata getter which infers
	 * from modelMetadata.supported_endpoints and configuration.
	 */
	get urlOrRequestMetadata(): string | QuizRequestMetadata | undefined {
		// If metadata has an explicit urlOrRequestMetadata, use it (BYOK, xtab)
		const explicit = (this.modelMetadata as Record<string, unknown>).urlOrRequestMetadata as string | QuizRequestMetadata | undefined;
		if (explicit) {
			return explicit;
		}
		// Infer from supported_endpoints (aligned with Copilot's ChatEndpoint.urlOrRequestMetadata)
		const supportedEndpoints = (this.modelMetadata as Record<string, unknown>).supported_endpoints as QuizModelSupportedEndpoint[] | undefined;
		if (supportedEndpoints) {
			if (supportedEndpoints.includes(QuizModelSupportedEndpoint.Responses)) {
				return { type: QuizRequestType.ChatResponses };
			}
			if (supportedEndpoints.includes(QuizModelSupportedEndpoint.Messages)) {
				return { type: QuizRequestType.ChatMessages };
			}
			if (supportedEndpoints.includes(QuizModelSupportedEndpoint.ChatCompletions)) {
				return { type: QuizRequestType.ChatCompletions };
			}
		}
		// Default: undefined → ILanguageModelsService bridge
		return undefined;
	}

	// --- Request customization (aligned with Copilot's IEndpoint + IChatEndpoint)

	/**
	 * Whether this endpoint owns its own authorization credentials.
	 * For BYOK endpoints, this is true (they supply their own api-key/Authorization).
	 */
	get ownsAuthorization(): boolean | undefined { return undefined; }

	/**
	 * The API type this endpoint uses.
	 * Determined by the urlOrRequestMetadata type and supported_endpoints.
	 * Aligned with Copilot's ChatEndpoint.apiType getter.
	 */
	get apiType(): 'chatCompletions' | 'responses' | 'messages' | undefined {
		const urlOrMeta = this.urlOrRequestMetadata;
		if (typeof urlOrMeta === 'string' || urlOrMeta === undefined) {
			// Check supported_endpoints for inference
			const supportedEndpoints = (this.modelMetadata as Record<string, unknown>).supported_endpoints as QuizModelSupportedEndpoint[] | undefined;
			if (supportedEndpoints) {
				if (!supportedEndpoints.includes(QuizModelSupportedEndpoint.ChatCompletions) &&
					supportedEndpoints.includes(QuizModelSupportedEndpoint.Responses)) {
					return 'responses';
				}
				if (supportedEndpoints.includes(QuizModelSupportedEndpoint.Messages)) {
					return 'messages';
				}
			}
			return undefined;
		}
		switch (urlOrMeta.type) {
			case QuizRequestType.ChatResponses: return 'responses';
			case QuizRequestType.ChatMessages: return 'messages';
			default: return 'chatCompletions';
		}
	}

	/**
	 * Get extra HTTP headers for this endpoint.
	 * Base implementation returns empty; subclasses override for model-specific headers.
	 * Aligned with Copilot's ChatEndpoint.getExtraHeaders().
	 */
	getExtraHeaders(_location?: string, _interactionTypeOverride?: string): Record<string, string> {
		// Base implementation: no extra headers
		// Future: AnthropicQuizEndpoint adds anthropic-beta header
		// Future: BYOKQuizEndpoint adds Authorization/api-key header
		return {};
	}

	/**
	 * Intercept and modify the request body before sending.
	 * Aligned with Copilot's ChatEndpoint.interceptBody().
	 */
	interceptBody(body: Record<string, unknown>): void {
		// Remove tools from requests to models that don't support them
		if (!this.supportsToolCalls && body['tools']) {
			delete body['tools'];
		}
	}

	/**
	 * Get endpoint-specific fetch options.
	 * Aligned with Copilot's IEndpoint.getEndpointFetchOptions().
	 */
	getEndpointFetchOptions(): { readonly suppressIntegrationId?: boolean } {
		return {};
	}

	isAvailable(): boolean {
		return !!this._languageModelsService.lookupLanguageModel(this.modelId);
	}

	getCapabilities(): IQuizModelCapabilities {
		return this._capabilities;
	}

	toEndpointInfo(): IQuizEndpointInfo {
		return {
			modelId: this.modelId,
			name: this.name,
			version: this.version,
			family: this.family,
			vendor: this.vendor,
			modelProvider: this.modelProvider,
			tokenizer: this.tokenizer,
			supportsToolCalls: this.supportsToolCalls,
			supportsVision: this.supportsVision,
			supportsPrediction: this.supportsPrediction,
			supportsThinkingContentInHistory: this.supportsThinkingContentInHistory,
			supportsAdaptiveThinking: this.supportsAdaptiveThinking,
			minThinkingBudget: this.minThinkingBudget,
			maxThinkingBudget: this.maxThinkingBudget,
			supportsReasoningEffort: this.supportsReasoningEffort,
			supportsToolSearch: this.supportsToolSearch,
			supportsContextEditing: this.supportsContextEditing,
			supportedEditTools: this.supportedEditTools,
			modelMaxPromptTokens: this.modelMaxPromptTokens,
			maxOutputTokens: this.maxOutputTokens,
			maxPromptImages: this.maxPromptImages,
			isPremium: this.isPremium,
			multiplier: this.multiplier,
			restrictedToSkus: this.restrictedToSkus,
			priceCategory: this.priceCategory,
			isFallback: this.isFallback,
			tokenPricing: this.tokenPricing,
			customModel: this.customModel,
			isExtensionContributed: this.isExtensionContributed,
			showInModelPicker: this.showInModelPicker,
			degradationReason: this.degradationReason,
			urlOrRequestMetadata: this.urlOrRequestMetadata,
			apiType: this.apiType,
			ownsAuthorization: this.ownsAuthorization,
			isAvailable: this.isAvailable(),
		};
	}

	/**
	 * Send a chat request to the model with full options.
	 * Aligned with Copilot's makeChatRequest2.
	 * Converts Quiz request options to ILanguageModelsService request options.
	 * Includes stateful marker retry and image limit filtering.
	 */
	async *sendChatRequest(
		messages: readonly IQuizPromptMessage[],
		options: IQuizChatRequestOptions,
		token: CancellationToken,
	): AsyncIterable<IQuizResponseDelta> {
		// Dual-path routing (aligned with Copilot's ChatMLFetcherImpl):
		// - If urlOrRequestMetadata is set → route through IQuizNetworkService
		// - If undefined → bridge through ILanguageModelsService (default)
		if (this.urlOrRequestMetadata !== undefined && this._networkService) {
			yield* this._sendViaNetworkService(messages, options, token);
			return;
		}

		// Default path: bridge through ILanguageModelsService
		yield* this._sendViaLanguageModelsService(messages, options, token);
	}

	/**
	 * Send request via IQuizNetworkService (dual-path routing).
	 * Aligned with Copilot's ChatMLFetcherImpl → networkRequest() path.
	 * Used when urlOrRequestMetadata is set (string URL or QuizRequestMetadata).
	 */
	private async *_sendViaNetworkService(
		messages: readonly IQuizPromptMessage[],
		options: IQuizChatRequestOptions,
		token: CancellationToken,
	): AsyncIterable<IQuizResponseDelta> {
		if (!this.urlOrRequestMetadata || !this._networkService) {
			throw new Error('[QuizEndpoint] Network routing requested but urlOrRequestMetadata or networkService not available');
		}

		this._logService.debug(`[QuizEndpoint] Routing request via network service (type: ${typeof this.urlOrRequestMetadata})`);

		const body = this.createRequestBody?.(messages, options) ?? { messages, model: this.modelId, ...options };

		// Use networkRequestStream for SSE streaming (aligned with Copilot's streaming path)
		for await (const chunk of this._networkService.networkRequestStream(
			{
				urlOrRequestMetadata: this.urlOrRequestMetadata,
				headers: this.getExtraHeaders?.() ?? {},
				getExtraHeaders: this.getExtraHeaders,
				interceptBody: this.interceptBody as ((body: Record<string, unknown>) => void) | undefined,
				getEndpointFetchOptions: this.getEndpointFetchOptions,
			},
			{
				body,
				method: 'POST',
				token,
				callSite: `quiz-endpoint-${this.modelId}`,
				stream: true,
				headers: {
					'Content-Type': 'application/json',
				},
			},
		)) {
			// Check for error status
			if (chunk.errorStatus !== undefined && chunk.errorStatus >= 400) {
				const errorBody = chunk.data as Record<string, unknown> | null;
				const errMsg = errorBody?.error
					? JSON.stringify(errorBody.error)
					: `HTTP ${chunk.errorStatus}`;
				throw new Error(`[QuizEndpoint] Request failed: ${errMsg}`);
			}

			const data = chunk.data as Record<string, unknown> | null;
			if (!data) { continue; }

			// OpenAI Chat Completions API format (delta-based)
			if (Array.isArray(data.choices)) {
				for (const choice of data.choices as Array<Record<string, unknown>>) {
					const delta = choice.delta as Record<string, unknown> | undefined;
					if (delta) {
						if (delta.content) {
							yield { text: String(delta.content) };
						}
						if (delta.tool_calls) {
							const toolCalls = (delta.tool_calls as Array<Record<string, unknown>>).map((tc: Record<string, unknown>) => ({
								id: String(tc.id ?? ''),
								name: String((tc.function as Record<string, unknown> | undefined)?.name ?? ''),
								arguments: String((tc.function as Record<string, unknown> | undefined)?.arguments ?? ''),
							}));
							yield { toolCalls };
						}
					}
					if (choice.finish_reason) {
						yield { finishReason: String(choice.finish_reason) };
					}
				}
			}

			// OpenAI Responses API format (event-based)
			if (data.type) {
				const eventType = data.type as string;
				if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
					yield { text: (data.delta as string) ?? '' };
				} else if (eventType === 'response.function_call_arguments.delta') {
					// Accumulate tool call arguments — handled at the fetcher level
				} else if (eventType === 'response.completed' || eventType === 'response.done') {
					const response = data.response as Record<string, unknown> | undefined;
					if (response?.id) {
						yield { statefulMarker: String(response.id) };
					}
					yield { finishReason: 'stop' };
				} else if (eventType === 'response.reasoning.delta') {
					yield { thinking: { text: (data.delta as string) ?? '' }, phase: 'thinking' };
				}
			}

			// Anthropic Messages API format
			if (data.content_block) {
				const contentBlock = data.content_block as Record<string, unknown>;
				if (contentBlock.type === 'text') {
					yield { text: String(contentBlock.text ?? '') };
				} else if (contentBlock.type === 'tool_use') {
					yield {
						toolCalls: [{
							id: String(contentBlock.id ?? ''),
							name: String(contentBlock.name ?? ''),
							arguments: String(contentBlock.input ? JSON.stringify(contentBlock.input) : ''),
						}],
					};
				}
			}
			if (data.delta) {
				const delta = data.delta as Record<string, unknown>;
				if (delta.text) {
					yield { text: String(delta.text) };
				}
			}
			if (data.message) {
				const message = data.message as Record<string, unknown>;
				if (message.stop_reason) {
					yield { finishReason: String(message.stop_reason) };
				}
			}
		}
	}

	/**
	 * Parse a network response chunk into a QuizResponseDelta.
	 * Aligned with Copilot's processResponseFromChatEndpoint.
	 */
	// @ts-expect-error unused method kept for future use
	private _parseNetworkResponseChunk(chunk: Record<string, unknown>): IQuizResponseDelta {
		// OpenAI-style response
		if ((chunk.choices as unknown[] | undefined)?.[0]) {
			const choice = (chunk.choices as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
			const delta = choice.delta as Record<string, unknown> | undefined;
			if (delta?.content) {
				return { text: String(delta.content) };
			}
			if (delta?.tool_calls) {
				const toolCalls = (delta.tool_calls as Array<Record<string, unknown>>).map((tc: Record<string, unknown>) => ({
					id: String(tc.id ?? ''),
					name: String((tc.function as Record<string, unknown> | undefined)?.name ?? ''),
					arguments: String((tc.function as Record<string, unknown> | undefined)?.arguments ?? ''),
				}));
				return { toolCalls };
			}
		}
		// Anthropic-style response
		if ((chunk.content as unknown[] | undefined)?.[0]) {
			const content = (chunk.content as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
			if (content.type === 'text') {
				return { text: String(content.text ?? '') };
			}
		}
		// Fallback: return raw text if available
		if (chunk.text) {
			return { text: String(chunk.text) };
		}
		return { text: '' };
	}

	/**
	 * Send request via ILanguageModelsService (default bridge path).
	 * This is the original path used when urlOrRequestMetadata is undefined.
	 */
	private async *_sendViaLanguageModelsService(
		messages: readonly IQuizPromptMessage[],
		options: IQuizChatRequestOptions,
		token: CancellationToken,
	): AsyncIterable<IQuizResponseDelta> {
		// Convert prompt messages to chat messages (includes image filtering)
		const chatMessages = quizPromptMessagesToChatMessages(messages, this._capabilities.maxPromptImages);
		const requestOptions = this._buildLanguageModelsRequestOptions(options);

		this._logService.debug(`[QuizEndpoint] Sending request to model ${this.modelId} with ${messages.length} messages, debugName=${options.debugName}`);

		// First attempt
		let streamResult = await this._sendRequest(chatMessages, requestOptions, token);

		// Stateful marker retry: if the response indicates an invalid stateful marker,
		// retry without the previous_response_id (aligned with Copilot's makeChatRequest2)
		if (streamResult.type === 'invalidStatefulMarker') {
			this._logService.debug(`[QuizEndpoint] Invalid stateful marker, retrying without previousResponseId`);
			delete requestOptions.previousResponseId;
			streamResult = await this._sendRequest(chatMessages, requestOptions, token);
		}

		if (streamResult.type === 'error') {
			throw streamResult.error;
		}

		// After handling error and invalidStatefulMarker, streamResult must be success
		if (streamResult.type !== 'success') {
			throw new Error('Unexpected stream result state');
		}
		const stream = streamResult.stream;
		const toolCalls: IQuizToolCall[] = [];

		for await (const partOrArray of stream) {
			const parts = Array.isArray(partOrArray) ? partOrArray : [partOrArray];
			for (const part of parts) {
				if (part.type === 'text') {
					yield { text: (part as IChatResponseTextPart).value };
				} else if (part.type === 'tool_use') {
					const toolPart = part as IChatResponseToolUsePart;
					const toolCall: IQuizToolCall = {
						id: toolPart.toolCallId,
						name: toolPart.name,
						arguments: typeof toolPart.parameters === 'string' ? toolPart.parameters : JSON.stringify(toolPart.parameters),
					};
					toolCalls.push(toolCall);
					yield { toolCalls: [toolCall] };
				} else if (part.type === 'thinking') {
					const thinkPart = part as IChatResponseThinkingPart;
					const delta: IQuizThinkingDelta = {
						text: thinkPart.value ?? '',
						id: thinkPart.id,
						metadata: thinkPart.metadata,
					};
					yield { thinking: delta, phase: 'thinking' };
				}
			}
		}

		// Final delta with finish reason
		if (toolCalls.length > 0) {
			yield { toolCalls, finishReason: 'tool_calls' };
		} else {
			yield { finishReason: 'stop' };
		}
	}

	/**
	 * Send the actual request to ILanguageModelsService.
	 * Returns a discriminated union to support stateful marker retry.
	 */
	private async _sendRequest(
		chatMessages: IChatMessage[],
		requestOptions: Record<string, unknown>,
		token: CancellationToken,
	): Promise<{ type: 'success'; stream: AsyncIterable<IChatResponsePart | IChatResponsePart[]> } | { type: 'invalidStatefulMarker' } | { type: 'error'; error: Error }> {
		try {
			const response = await this._languageModelsService.sendChatRequest(
				this.modelId,
				undefined, // from — not an extension
				chatMessages,
				requestOptions,
				token,
			);

			// Check for invalid stateful marker in the response
			// ILanguageModelsService doesn't expose this directly, but we can detect
			// it from the response. For now, we assume success and let the stream
			// processing handle any errors.
			return { type: 'success', stream: response.stream };
		} catch (err) {
			// Detect invalid stateful marker errors from the model API
			// The error message pattern varies by provider but typically contains
			// "invalid_stateful_marker" or "previous_response_id"
			const errMsg = String(err);
			if (errMsg.includes('invalid_stateful_marker') || errMsg.includes('previous_response_id')) {
				return { type: 'invalidStatefulMarker' };
			}
			return { type: 'error', error: err instanceof Error ? err : new Error(errMsg) };
		}
	}

	/**
	 * Compute token count for a message using the model's tokenizer.
	 * Aligned with Copilot's IEndpoint.acquireTokenizer + ITokenizer.countTokens.
	 */
	async computeTokenCount(message: string, token: CancellationToken): Promise<number> {
		return this._languageModelsService.computeTokenLength(this.modelId, message, token);
	}

	/**
	 * Compute token count for a prompt message (including tool calls, thinking, etc.).
	 */
	async computeTokenCountForMessage(message: IQuizPromptMessage, token: CancellationToken): Promise<number> {
		const text = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
		return this.computeTokenCount(text, token);
	}

	/**
	 * Create the request body that would be sent to the model endpoint.
	 * Useful for debugging and logging.
	 * Aligned with Copilot's IChatEndpoint.createRequestBody.
	 */
	createRequestBody(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions): IQuizEndpointBody {
		// Responses API uses 'input' array instead of 'messages' array
		// Aligned with Copilot's CopilotChatEndpoint.interceptBody()
		if (this.apiType === 'responses') {
			return this._createResponsesRequestBody(messages, options);
		}
		return this._createChatCompletionsRequestBody(messages, options);
	}

	/**
	 * Build request body for OpenAI Chat Completions API format.
	 * Aligned with Copilot's default request body construction.
	 */
	private _createChatCompletionsRequestBody(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions): IQuizEndpointBody {
		const body: IQuizEndpointBody = {
			model: this.modelId,
			messages: [...messages],
			stream: true,
		};
		if (options.tools) {
			body.tools = options.tools;
		}
		if (options.toolChoice) {
			body.tool_choice = options.toolChoice;
		}
		if (options.maxOutputTokens) {
			body.max_output_tokens = options.maxOutputTokens;
		}
		if (options.temperature !== undefined) {
			body.temperature = options.temperature;
		}
		if (options.reasoningEffort) {
			body.reasoning_effort = options.reasoningEffort;
		}
		if (options.modelCapabilities?.enableThinking) {
			body.thinking = { type: 'enabled' };
		}
		if (options.previousResponseId) {
			body.previous_response_id = options.previousResponseId;
		}
		if (options.prediction) {
			body.prediction = options.prediction;
		}
		if (options.includeUsage) {
			body.stream_options = { include_usage: true };
		}
		return body;
	}

	/**
	 * Build request body for OpenAI Responses API format.
	 * Aligned with Copilot's CopilotChatEndpoint.interceptBody() which
	 * converts the messages array into an input array for the Responses API.
	 *
	 * The Responses API uses:
	 * - `input` instead of `messages`
	 * - `previous_response_id` for stateful conversations
	 * - `text.verbosity` for output verbosity control
	 * - `store` for response persistence
	 * - `include` for encrypted reasoning content
	 */
	private _createResponsesRequestBody(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions): IQuizEndpointBody {
		const body: IQuizEndpointBody = {
			model: this.modelId,
			stream: true,
		};

		// Convert messages to Responses API input format
		// The Responses API expects an array of input items, which can be
		// messages (role + content) or previous_response_id references.
		if (options.previousResponseId) {
			body.previous_response_id = options.previousResponseId;
			// When continuing a conversation, only send new messages as input
			body.input = [...messages];
		} else {
			body.input = [...messages];
		}

		if (options.tools) {
			body.tools = options.tools;
		}
		if (options.toolChoice) {
			body.tool_choice = options.toolChoice;
		}
		if (options.maxOutputTokens) {
			body.max_output_tokens = options.maxOutputTokens;
		}
		if (options.temperature !== undefined) {
			body.temperature = options.temperature;
		}
		if (options.reasoningEffort) {
			body.reasoning_effort = options.reasoningEffort;
		}
		if (options.modelCapabilities?.enableThinking) {
			body.thinking = { type: 'enabled' };
			// Request encrypted reasoning content for thinking models
			body.include = ['reasoning.encrypted_content'];
		}
		if (options.prediction) {
			body.prediction = options.prediction;
		}
		if (options.includeUsage) {
			body.stream_options = { include_usage: true };
		}
		// Responses API: enable response storage for stateful conversations
		body.store = true;
		// Responses API: truncation strategy
		body.truncation = 'auto';

		return body;
	}

	/**
	 * Clone this endpoint with a different modelMaxPromptTokens value.
	 * Used for token budget management when the effective prompt limit changes.
	 * Aligned with Copilot's IChatEndpoint.cloneWithTokenOverride.
	 */
	cloneWithTokenOverride(modelMaxPromptTokens: number): IQuizEndpoint {
		return new QuizLanguageModelEndpointWithTokenOverride(this, modelMaxPromptTokens);
	}

	/**
	 * Build ILanguageModelsService request options from Quiz request options.
	 */
	private _buildLanguageModelsRequestOptions(options: IQuizChatRequestOptions): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		if (options.tools) {
			result.tools = options.tools;
		}
		if (options.toolChoice) {
			result.toolChoice = options.toolChoice;
		}
		if (options.maxOutputTokens) {
			result.maxTokens = options.maxOutputTokens;
		}
		if (options.temperature !== undefined) {
			result.temperature = options.temperature;
		}
		if (options.modelCapabilities?.enableThinking) {
			result.thinking = { type: 'enabled' };
		}
		if (options.reasoningEffort) {
			result.reasoningEffort = options.reasoningEffort;
		}
		return result;
	}

	override dispose(): void {
		super.dispose();
		this._onDidChangeAvailability.dispose();
	}
}

/**
 * Endpoint wrapper that overrides modelMaxPromptTokens for token budget management.
 * Aligned with Copilot's cloneWithTokenOverride pattern.
 */
class QuizLanguageModelEndpointWithTokenOverride implements IQuizEndpoint {

	private readonly _inner: QuizLanguageModelEndpoint;
	private readonly _overrideMaxPromptTokens: number;

	constructor(inner: QuizLanguageModelEndpoint, modelMaxPromptTokens: number) {
		this._inner = inner;
		this._overrideMaxPromptTokens = modelMaxPromptTokens;
	}

	get onDidChangeAvailability() { return this._inner.onDidChangeAvailability; }
	get modelId() { return this._inner.modelId; }
	get name() { return this._inner.name; }
	get version() { return this._inner.version; }
	get family() { return this._inner.family; }
	get vendor() { return this._inner.vendor; }
	get modelProvider() { return this._inner.modelProvider; }
	get tokenizer() { return this._inner.tokenizer; }
	get supportsToolCalls() { return this._inner.supportsToolCalls; }
	get supportsVision() { return this._inner.supportsVision; }
	get supportsPrediction() { return this._inner.supportsPrediction; }
	get supportsThinkingContentInHistory() { return this._inner.supportsThinkingContentInHistory; }
	get supportsAdaptiveThinking() { return this._inner.supportsAdaptiveThinking; }
	get minThinkingBudget() { return this._inner.minThinkingBudget; }
	get maxThinkingBudget() { return this._inner.maxThinkingBudget; }
	get supportsReasoningEffort() { return this._inner.supportsReasoningEffort; }
	get supportsToolSearch() { return this._inner.supportsToolSearch; }
	get supportsContextEditing() { return this._inner.supportsContextEditing; }
	get supportedEditTools() { return this._inner.supportedEditTools; }
	get modelMaxPromptTokens() { return this._overrideMaxPromptTokens; }
	get maxOutputTokens() { return this._inner.maxOutputTokens; }
	get maxPromptImages() { return this._inner.maxPromptImages; }
	get isPremium() { return this._inner.isPremium; }
	get multiplier() { return this._inner.multiplier; }
	get restrictedToSkus() { return this._inner.restrictedToSkus; }
	get priceCategory() { return this._inner.priceCategory; }
	get isFallback() { return this._inner.isFallback; }
	get tokenPricing() { return this._inner.tokenPricing; }
	get customModel() { return this._inner.customModel; }
	get isExtensionContributed() { return this._inner.isExtensionContributed; }
	get showInModelPicker() { return this._inner.showInModelPicker; }
	get degradationReason() { return this._inner.degradationReason; }
	get urlOrRequestMetadata() { return this._inner.urlOrRequestMetadata; }
	get ownsAuthorization() { return this._inner.ownsAuthorization; }
	get apiType() { return this._inner.apiType; }

	isAvailable() { return this._inner.isAvailable(); }
	getCapabilities() { return this._inner.getCapabilities(); }
	toEndpointInfo() { return this._inner.toEndpointInfo(); }
	sendChatRequest(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions, token: CancellationToken) { return this._inner.sendChatRequest(messages, options, token); }
	computeTokenCount(message: string, token: CancellationToken) { return this._inner.computeTokenCount(message, token); }
	computeTokenCountForMessage(message: IQuizPromptMessage, token: CancellationToken) { return this._inner.computeTokenCountForMessage(message, token); }
	createRequestBody(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions) { return this._inner.createRequestBody(messages, options); }
	getExtraHeaders(location?: string, interactionTypeOverride?: string) { return this._inner.getExtraHeaders(location, interactionTypeOverride); }
	interceptBody(body: Record<string, unknown>) { return this._inner.interceptBody(body); }
	getEndpointFetchOptions() { return this._inner.getEndpointFetchOptions(); }
	cloneWithTokenOverride(modelMaxPromptTokens: number) { return new QuizLanguageModelEndpointWithTokenOverride(this._inner, modelMaxPromptTokens); }
}

// #endregion

// #region Message conversion utilities

/**
 * Convert Quiz's IQuizPromptMessage[] to VS Code's IChatMessage[].
 */
export function quizPromptMessagesToChatMessages(messages: readonly IQuizPromptMessage[], imageLimit?: number): IChatMessage[] {
	let imageCount = 0;
	return messages.map(msg => {
		const role = msg.role === 'assistant' ? ChatMessageRole.Assistant
			: msg.role === 'system' ? ChatMessageRole.System
				: msg.role === 'tool' ? ChatMessageRole.User
					: ChatMessageRole.User;

		const content: (IChatMessageTextPart | IChatResponseToolUsePart | IChatMessageToolResultPart | IChatMessageImagePart)[] = [];

		if (typeof msg.content === 'string') {
			content.push({ type: 'text', value: msg.content });
		}

		// Tool result messages: include tool_result part
		if (msg.role === 'tool' && msg.toolCallId) {
			content.push({
				type: 'tool_result',
				toolCallId: msg.toolCallId,
				value: [{ type: 'text', value: msg.content }],
			});
		}

		// Assistant messages with tool calls: include tool_use parts
		if (msg.role === 'assistant' && msg.toolCalls) {
			for (const tc of msg.toolCalls) {
				content.push({
					type: 'tool_use',
					name: tc.name,
					toolCallId: tc.id,
					parameters: tc.arguments as unknown as Record<string, unknown>,
				});
			}
		}

		// Filter images if the model has a known limit (aligned with Copilot's filterHistoryImages)
		const filteredContent = imageLimit
			? content.filter(part => {
				if (part.type === 'image_url') {
					imageCount++;
					return imageCount <= imageLimit;
				}
				return true;
			})
			: content;

		return { role, content: filteredContent, name: msg.toolName };
	});
}

// #endregion

// #region IntentEndpoint factory (aligned with Copilot's endpoint capability resolution)

/**
 * Create an IQuizIntentEndpoint from a model ID and its metadata.
 * Populates capabilities from ILanguageModelChatMetadata.
 */
export function createQuizIntentEndpoint(modelId: string, metadata: ILanguageModelChatMetadata): IQuizIntentEndpoint {
	return {
		model: modelId,
		family: metadata.family,
		vendor: metadata.vendor,
		supportsToolCalls: metadata.capabilities?.toolCalling ?? false,
		maxOutputTokens: metadata.maxOutputTokens,
		maxInputTokens: metadata.maxInputTokens,
		name: metadata.name,
		identityName: metadata.name,
	};
}

// #endregion
