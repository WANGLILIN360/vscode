/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import { ILanguageModelsService, ILanguageModelChatMetadata } from '../../../chat/common/languageModels.js';
import { QuizRequestType, QuizRequestMetadata } from '../../common/endpoint/quizQAPIClient.js';
import type { IQuizNetworkService } from '../../common/endpoint/quizNetwork.js';
import { QuizLanguageModelEndpoint } from './quizEndpointProviderImpl.js';

// #region BYOKQuizEndpoint (aligned with Copilot's OpenAIEndpoint)

/**
 * BYOK (Bring Your Own Key) endpoint that uses a user-supplied API key
 * and a custom model URL instead of the CAPI Copilot token.
 *
 * Aligned with Copilot's OpenAIEndpoint (from byok/node/openAIEndpoint.ts).
 *
 * Key differences from base QuizLanguageModelEndpoint:
 * - `ownsAuthorization = true` — prevents CAPI token from being sent
 * - `urlOrRequestMetadata` = string URL (the BYOK endpoint URL)
 * - `getExtraHeaders()` returns `Authorization: Bearer <apiKey>` or `api-key: <apiKey>` for Azure
 * - Custom headers from model metadata are sanitized and included
 */
export class BYOKQuizEndpoint extends QuizLanguageModelEndpoint {

	// Reserved headers that cannot be overridden for security and functionality reasons
	// Aligned with Copilot's OpenAIEndpoint._reservedHeaders
	private static readonly _reservedHeaders: ReadonlySet<string> = new Set([
		// Forbidden Request Headers (RFC 7230)
		'accept-charset', 'accept-encoding', 'access-control-request-headers',
		'access-control-request-method', 'connection', 'content-length', 'cookie',
		'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin',
		'permissions-policy', 'referer', 'te', 'trailer', 'transfer-encoding',
		'upgrade', 'user-agent', 'via',
		// Forwarding & Routing
		'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
		// Others
		'api-key', 'authorization', 'content-type', 'openai-intent',
		'x-github-api-version', 'x-initiator', 'x-interaction-id',
		'x-interaction-type', 'x-onbehalf-extension-id', 'x-request-id',
		'x-vscode-user-agent-library-version',
	]);

	private static readonly _validHeaderNamePattern = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
	private static readonly _maxHeaderNameLength = 256;
	private static readonly _maxHeaderValueLength = 8192;
	private static readonly _maxCustomHeaderCount = 20;

	private readonly _apiKey: string;
	private readonly _modelUrl: string;
	private readonly _customHeaders: Record<string, string>;

	constructor(
		modelId: string,
		modelMetadata: ILanguageModelChatMetadata,
		apiKey: string,
		modelUrl: string,
		languageModelsService: ILanguageModelsService,
		logService: ILogService,
		networkService: IQuizNetworkService | undefined,
	) {
		super(modelId, modelMetadata, languageModelsService, logService, networkService);
		this._apiKey = apiKey;
		this._modelUrl = modelUrl;
		this._customHeaders = this._sanitizeCustomHeaders((modelMetadata as Record<string, unknown>).requestHeaders as Record<string, string> | undefined);
	}

	/**
	 * BYOK endpoints own their authorization — the CAPI Copilot token
	 * must NOT be sent to third-party endpoints.
	 */
	override get ownsAuthorization(): boolean { return true; }

	/**
	 * BYOK endpoints route to the user-supplied model URL.
	 */
	override get urlOrRequestMetadata(): string | QuizRequestMetadata | undefined { return this._modelUrl; }

	/**
	 * BYOK endpoints always use chatCompletions API type.
	 */
	override get apiType(): 'chatCompletions' | 'responses' | 'messages' {
		return 'chatCompletions';
	}

	/**
	 * BYOK endpoints default to O200K tokenizer.
	 * Override if the model uses a different tokenizer (e.g., 'cl100k_base' for GPT-3.5).
	 */
	override get tokenizer(): string { return 'o200k_base'; }

	/**
	 * Get extra HTTP headers including the API key and custom headers.
	 * Aligned with Copilot's OpenAIEndpoint.getExtraHeaders().
	 */
	override getExtraHeaders(_location?: string, _interactionTypeOverride?: string): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		// Azure OpenAI uses api-key header, others use Authorization Bearer
		if (this._modelUrl.includes('openai.azure')) {
			headers['api-key'] = this._apiKey;
		} else {
			headers['Authorization'] = `Bearer ${this._apiKey}`;
		}

		// Merge sanitized custom headers
		Object.assign(headers, this._customHeaders);

		return headers;
	}

	override getEndpointFetchOptions(): { readonly suppressIntegrationId?: boolean } {
		// BYOK endpoints should suppress the integration ID header
		// since they don't go through CAPI
		return { suppressIntegrationId: true };
	}

	private _sanitizeCustomHeaders(headers: Record<string, string> | undefined): Record<string, string> {
		if (!headers) {
			return {};
		}

		const entries = Object.entries(headers);
		if (entries.length > BYOKQuizEndpoint._maxCustomHeaderCount) {
			console.warn(`[BYOKQuizEndpoint] Model '${this.modelId}' has ${entries.length} custom headers, exceeding limit of ${BYOKQuizEndpoint._maxCustomHeaderCount}. Only first ${BYOKQuizEndpoint._maxCustomHeaderCount} will be processed.`);
		}

		const sanitized: Record<string, string> = {};
		for (const [key, value] of entries.slice(0, BYOKQuizEndpoint._maxCustomHeaderCount)) {
			const lowerKey = key.toLowerCase();

			// Skip reserved headers
			if (BYOKQuizEndpoint._reservedHeaders.has(lowerKey)) {
				console.warn(`[BYOKQuizEndpoint] Skipping reserved header '${key}' for model '${this.modelId}'.`);
				continue;
			}

			// Validate header name format
			if (!BYOKQuizEndpoint._validHeaderNamePattern.test(key)) {
				console.warn(`[BYOKQuizEndpoint] Skipping invalid header name '${key}' for model '${this.modelId}'.`);
				continue;
			}

			// Validate lengths
			if (key.length > BYOKQuizEndpoint._maxHeaderNameLength || value.length > BYOKQuizEndpoint._maxHeaderValueLength) {
				console.warn(`[BYOKQuizEndpoint] Skipping oversized header '${key}' for model '${this.modelId}'.`);
				continue;
			}

			// Block proxy-* and sec-* headers
			if (lowerKey.startsWith('proxy-') || lowerKey.startsWith('sec-')) {
				continue;
			}

			sanitized[key] = value;
		}

		return sanitized;
	}
}

// #endregion

// #region AnthropicQuizEndpoint (aligned with Copilot's Anthropic ChatEndpoint behavior)

/**
 * Anthropic model endpoint that adds anthropic-beta headers
 * and uses the Messages API format.
 *
 * Aligned with Copilot's ChatEndpoint.getAnthropicBetaHeader() behavior
 * (from platform/endpoint/node/chatEndpoint.ts).
 *
 * Key differences from base QuizLanguageModelEndpoint:
 * - `urlOrRequestMetadata` = QuizRequestMetadata with ChatMessages type
 * - `apiType` = 'messages'
 * - `getExtraHeaders()` returns anthropic-beta header with feature flags
 */
export class AnthropicQuizEndpoint extends QuizLanguageModelEndpoint {

	constructor(
		modelId: string,
		modelMetadata: ILanguageModelChatMetadata,
		languageModelsService: ILanguageModelsService,
		logService: ILogService,
		networkService: IQuizNetworkService | undefined,
	) {
		super(modelId, modelMetadata, languageModelsService, logService, networkService);
	}

	/**
	 * Anthropic endpoints use the Messages API.
	 */
	override get apiType(): 'chatCompletions' | 'responses' | 'messages' {
		return 'messages';
	}

	/**
	 * Anthropic endpoints route through the CAPI Messages API path.
	 */
	override get urlOrRequestMetadata(): string | QuizRequestMetadata | undefined {
		return { type: QuizRequestType.ChatMessages };
	}

	/**
	 * Claude models use the CL100K tokenizer.
	 * Aligned with Copilot's ChatEndpoint.tokenizer for Claude family.
	 */
	override get tokenizer(): string { return 'cl100k_base'; }

	/**
	 * Get Anthropic-specific headers including anthropic-beta.
	 * Aligned with Copilot's ChatEndpoint.getAnthropicBetaHeader().
	 */
	override getExtraHeaders(location?: string, interactionTypeOverride?: string): Record<string, string> {
		const betas: string[] = [];

		// Add interleaved-thinking beta for non-adaptive-thinking models
		if (!this.supportsAdaptiveThinking) {
			betas.push('interleaved-thinking-2025-05-14');
		}

		// Add advanced-tool-use beta for tool search models
		if (this.supportsToolSearch) {
			betas.push('advanced-tool-use-2025-11-20');
		}

		// Add context-management beta for context editing models
		if (this.supportsContextEditing) {
			betas.push('context-management-2025-06-27');
		}

		// Add extended-cache-ttl beta — only for non-subagent agent conversations
		// Aligned with Copilot's isExtendedCacheTtlEnabled logic
		const isSubagent = interactionTypeOverride === 'conversation-subagent';
		if (!isSubagent) {
			betas.push('extended-cache-ttl-2025-04-11');
		}

		return betas.length > 0 ? { 'anthropic-beta': betas.join(',') } : {};
	}

	/**
	 * Anthropic-specific body interception.
	 * Aligned with Copilot's ChatEndpoint.interceptBody() + messagesApi.ts logic.
	 */
	override interceptBody(body: Record<string, unknown>): void {
		super.interceptBody(body);

		// Anthropic Messages API uses max_tokens instead of max_output_tokens
		if (body['max_output_tokens'] !== undefined && body['max_tokens'] === undefined) {
			body['max_tokens'] = body['max_output_tokens'];
			delete body['max_output_tokens'];
		}
	}
}

// #endregion

// #region ExtensionContributedQuizEndpoint (aligned with Copilot's ExtensionContributedChatEndpoint)

/**
 * Endpoint for extension-contributed language models that bypass the
 * CAPI/fetcher pipeline entirely and use ILanguageModelsService directly.
 *
 * Aligned with Copilot's ExtensionContributedChatEndpoint
 * (from platform/endpoint/vscode-node/extChatEndpoint.ts).
 *
 * Key differences from base QuizLanguageModelEndpoint:
 * - `urlOrRequestMetadata` = undefined (always uses ILanguageModelsService)
 * - `isExtensionContributed` = true
 * - Does NOT go through CAPI or fetcher pipeline
 */
export class ExtensionContributedQuizEndpoint extends QuizLanguageModelEndpoint {

	/** Whether this endpoint is contributed by an extension (not CAPI) */
	override get isExtensionContributed(): boolean { return true; }

	constructor(
		modelId: string,
		modelMetadata: ILanguageModelChatMetadata,
		languageModelsService: ILanguageModelsService,
		logService: ILogService,
	) {
		// Extension-contributed endpoints never use IQuizNetworkService
		super(modelId, modelMetadata, languageModelsService, logService, undefined);
	}

	/**
	 * Extension-contributed endpoints always use ILanguageModelsService.
	 * urlOrRequestMetadata stays undefined.
	 */
	override get apiType(): 'chatCompletions' | 'responses' | 'messages' | undefined {
		return undefined;
	}

	/**
	 * Extension-contributed models have unknown tokenizers.
	 * Token counting falls back to ILanguageModelsService's built-in counting.
	 */
	override get tokenizer(): string { return 'unknown'; }

	/**
	 * No extra headers — extension-contributed endpoints don't go through CAPI.
	 */
	override getExtraHeaders(_location?: string, _interactionTypeOverride?: string): Record<string, string> {
		return {};
	}

	/**
	 * No body interception — ILanguageModelsService handles message format.
	 */
	override interceptBody(_body: Record<string, unknown>): void {
		// No-op: ILanguageModelsService handles the body format
	}

	override getEndpointFetchOptions(): { readonly suppressIntegrationId?: boolean } {
		return {};
	}
}

// #endregion
