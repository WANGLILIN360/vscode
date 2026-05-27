/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ILanguageModelsService, IChatMessage, ChatMessageRole, IChatMessageTextPart, IChatMessageToolResultPart, IChatMessageImagePart, IChatResponsePart, IChatResponseTextPart, IChatResponseToolUsePart, IChatResponseThinkingPart, ILanguageModelChatMetadata, ILanguageModelChatSelector } from '../../../chat/common/languageModels.js';
import { IQuizEndpoint, IQuizEndpointProvider, IQuizChatRequestOptions, IQuizEndpointBody, IQuizResponseDelta } from '../../common/endpoint/quizEndpoint.js';
import { IQuizIntentEndpoint, IQuizPromptMessage, IQuizToolCall, IQuizThinkingDelta } from '../../common/intents/quizIntents.js';
import { QuizModelCapabilities, IQuizModelCapabilities } from '../../common/endpoint/quizModelCapabilities.js';

// #region QuizEndpointProvider (aligned with Copilot's IEndpointProvider)

export const QUIZ_DEFAULT_MODEL_SELECTOR: ILanguageModelChatSelector = { vendor: 'copilot' };

export class QuizEndpointProviderImpl extends Disposable implements IQuizEndpointProvider {

	declare readonly _serviceBrand: undefined;

	private readonly _endpoints = new Map<string, QuizLanguageModelEndpoint>();
	private readonly _onDidChangeModels = new Emitter<void>();
	readonly onDidChangeModels = this._onDidChangeModels.event;

	constructor(
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
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
			endpoint = new QuizLanguageModelEndpoint(modelId, metadata, this._languageModelsService, this._logService);
			this._endpoints.set(modelId, endpoint);
		}
		return endpoint;
	}

	async getDefaultEndpoint(): Promise<IQuizEndpoint | undefined> {
		const modelIds = await this._languageModelsService.selectLanguageModels(QUIZ_DEFAULT_MODEL_SELECTOR);
		if (modelIds.length === 0) {
			this._logService.warn('[QuizEndpointProvider] No models available for default selector');
			return undefined;
		}
		return this.getEndpoint(modelIds[0]);
	}

	async getAllModelIds(): Promise<string[]> {
		return this._languageModelsService.selectLanguageModels({});
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

	constructor(
		public readonly modelId: string,
		public readonly modelMetadata: ILanguageModelChatMetadata,
		private readonly _languageModelsService: ILanguageModelsService,
		private readonly _logService: ILogService,
	) {
		super();
		this._capabilities = QuizModelCapabilities.fromMetadata(modelId, modelMetadata);
	}

	// --- Identity (aligned with Copilot's IEndpoint + IChatEndpoint)

	get name(): string { return this.modelMetadata.name; }
	get version(): string { return this.modelMetadata.version; }
	get family(): string { return this.modelMetadata.family ?? ''; }
	get vendor(): string { return this.modelMetadata.vendor; }
	get modelProvider(): string { return this.modelMetadata.vendor; }

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
	get supportedEditTools(): readonly string[] | undefined { return this._capabilities.supportedEditTools; }

	// --- Token limits (aligned with Copilot's IEndpoint.modelMaxPromptTokens + IChatEndpoint.maxOutputTokens)

	get modelMaxPromptTokens(): number { return this._capabilities.maxInputTokens; }
	get maxOutputTokens(): number { return this._capabilities.maxOutputTokens; }
	get maxPromptImages(): number | undefined { return this._capabilities.maxPromptImages; }

	// --- Pricing (aligned with Copilot's IChatEndpointTokenPricing)

	get isPremium(): boolean | undefined { return undefined; }
	get priceCategory(): string | undefined { return undefined; }
	get isFallback(): boolean { return false; }

	isAvailable(): boolean {
		return !!this._languageModelsService.lookupLanguageModel(this.modelId);
	}

	getCapabilities(): IQuizModelCapabilities {
		return this._capabilities;
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
	get priceCategory() { return this._inner.priceCategory; }
	get isFallback() { return this._inner.isFallback; }

	isAvailable() { return this._inner.isAvailable(); }
	getCapabilities() { return this._inner.getCapabilities(); }
	sendChatRequest(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions, token: CancellationToken) { return this._inner.sendChatRequest(messages, options, token); }
	computeTokenCount(message: string, token: CancellationToken) { return this._inner.computeTokenCount(message, token); }
	computeTokenCountForMessage(message: IQuizPromptMessage, token: CancellationToken) { return this._inner.computeTokenCountForMessage(message, token); }
	createRequestBody(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions) { return this._inner.createRequestBody(messages, options); }
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
