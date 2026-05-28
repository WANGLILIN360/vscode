/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import type { IQuizFetchOptions } from './quizFetcher.js';

// #region QuizRequestType (aligned with Copilot's RequestType)

/**
 * Classification of API request types for routing decisions.
 * Aligned with Copilot's RequestType (from @vscode/copilot-api).
 *
 * This determines which CAPI endpoint and authentication flow to use:
 * - CopilotToken: Token refresh / auth endpoint
 * - ChatCompletions: OpenAI Chat Completions API (/chat/completions)
 * - ChatResponses: OpenAI Responses API (/responses)
 * - ChatMessages: Anthropic Messages API (/v1/messages)
 * - Models: Model listing / capability endpoint
 */
export const enum QuizRequestType {
	/** Copilot token refresh request */
	CopilotToken = 'CopilotToken',
	/** OpenAI Chat Completions API */
	ChatCompletions = 'ChatCompletions',
	/** OpenAI Responses API */
	ChatResponses = 'ChatResponses',
	/** Anthropic Messages API */
	ChatMessages = 'ChatMessages',
	/** Model listing / capability endpoint */
	Models = 'Models',
	/** Telemetry / analytics endpoint */
	Telemetry = 'Telemetry',
}

// #endregion

// #region QuizRequestMetadata (aligned with Copilot's RequestMetadata)

/**
 * Metadata that routes a request through the CAPI SDK path.
 * Aligned with Copilot's RequestMetadata (from @vscode/copilot-api).
 *
 * When an endpoint's `urlOrRequestMetadata` is a `QuizRequestMetadata`
 * (instead of a plain string URL), the request goes through
 * `IQuizQAPIClientService.makeRequest()` instead of `IQuizFetcherService.fetch()`.
 *
 * This is the **QAPI SDK path** — it handles:
 * - CAPI authentication (Copilot token, HMAC signing)
 * - Endpoint URL resolution (api.githubcopilot.com)
 * - Request type-specific routing (chat-completions vs responses vs messages)
 * - Retry logic and error classification
 */
export type QuizRequestMetadata =
	| { readonly type: QuizRequestType.CopilotToken }
	| { readonly type: QuizRequestType.Telemetry }
	| { readonly type: QuizRequestType.ChatCompletions | QuizRequestType.ChatResponses | QuizRequestType.ChatMessages | QuizRequestType.Models; readonly isModelLab?: boolean };

// #endregion

// #region IQuizQAPIClientService (aligned with Copilot's ICAPIClientService)

export const IQuizQAPIClientService = createDecorator<IQuizQAPIClientService>('quizQAPIClientService');

/**
 * QAPI (Quiz API) client service — the CAPI SDK path for Quiz.
 * Aligned with Copilot's ICAPIClientService (from @vscode/copilot-api CAPIClient).
 *
 * This is the **CAPI SDK path** — it routes requests through GitHub's
 * Copilot API infrastructure with proper authentication, HMAC signing,
 * and endpoint resolution. Used for:
 * - CAPI official model LLM requests (when endpoint uses QuizRequestMetadata)
 * - All requests requiring GitHub Copilot API authentication
 * - Telemetry, ignore service, code search, embeddings, etc.
 *
 * For pure HTTP requests (BYOK, xtab, string URLs), use IQuizFetcherService.
 * The routing between the two is handled by IQuizNetworkService.networkRequest().
 *
 * ### Copilot's Dual-Path Architecture (mirrored in Quiz):
 *
 * ```
 * networkRequest(endpoint, request)
 *   ├── typeof endpoint.urlOrRequestMetadata === 'string'
 *   │     → IQuizFetcherService.fetch(url, request)        ← HTTP path
 *   │
 *   └── else (QuizRequestMetadata)
 *         → IQuizQAPIClientService.makeRequest(request, metadata)  ← CAPI path
 * ```
 */
export interface IQuizQAPIClientService {
	readonly _serviceBrand: undefined;

	/**
	 * Make an API request through the CAPI SDK.
	 * Aligned with Copilot's CAPIClient.makeRequest().
	 *
	 * Handles authentication, endpoint URL resolution, HMAC signing,
	 * and request type-specific routing automatically.
	 *
	 * @param options Request options (headers, body, method, etc.)
	 * @param metadata Request metadata specifying the API type and routing
	 * @returns The parsed response body
	 */
	makeRequest<T = unknown>(options: IQuizMakeRequestOptions, metadata: QuizRequestMetadata): Promise<T>;

	/**
	 * Update the CAPI domain configuration.
	 * Aligned with Copilot's CAPIClient.updateDomains().
	 * Called when the Copilot token is refreshed and endpoints may have changed.
	 *
	 * @param copilotToken The current Copilot token with endpoint info
	 * @param enterpriseUrlConfig Optional enterprise URL configuration
	 * @returns Whether any URLs changed
	 */
	updateDomains(copilotToken: IQuizCopilotToken | undefined, enterpriseUrlConfig?: string): IQuizDomainChangeResponse;

	/**
	 * Get the current CAPI API endpoint URL.
	 * Useful for constructing direct requests when needed.
	 */
	readonly apiUrl: string | undefined;

	/**
	 * Get the current telemetry endpoint URL.
	 */
	readonly telemetryUrl: string | undefined;

	/**
	 * Get the current proxy endpoint URL.
	 */
	readonly proxyUrl: string | undefined;
}

// #endregion

// #region IQuizMakeRequestOptions (aligned with Copilot's MakeRequestOptions)

/**
 * Options for a CAPI SDK request.
 * Aligned with Copilot's MakeRequestOptions (from @vscode/copilot-api).
 * Extends IQuizFetchOptions but makes callSite optional (auto-filled by SDK).
 */
export interface IQuizMakeRequestOptions extends Omit<IQuizFetchOptions, 'callSite'> {
	/** Call site identifier (optional, auto-filled if not provided) */
	readonly callSite?: string;
}

// #endregion

// #region IQuizCopilotToken (aligned with Copilot's CopilotToken)

/**
 * Copilot authentication token with endpoint information.
 * Aligned with Copilot's CopilotToken (from @vscode/copilot-api).
 */
export interface IQuizCopilotToken {
	/** API endpoint URLs */
	readonly endpoints: {
		readonly api?: string;
		readonly telemetry?: string;
		readonly proxy?: string;
		readonly 'origin-tracker'?: string;
	};
	/** SKU identifier */
	readonly sku: string;
}

// #endregion

// #region IQuizDomainChangeResponse (aligned with Copilot's IDomainChangeResponse)

/**
 * Response from updating CAPI domain configuration.
 * Aligned with Copilot's IDomainChangeResponse (from @vscode/copilot-api).
 */
export interface IQuizDomainChangeResponse {
	/** Whether the CAPI API URL changed */
	readonly capiUrlChanged: boolean;
	/** Whether the telemetry URL changed */
	readonly telemetryUrlChanged: boolean;
	/** Whether the dotcom URL changed */
	readonly dotcomUrlChanged: boolean;
	/** Whether the proxy URL changed */
	readonly proxyUrlChanged: boolean;
}

// #endregion

// #region IQuizExtensionInformation (aligned with Copilot's IExtensionInformation)

/**
 * Extension information for CAPI client construction.
 * Aligned with Copilot's IExtensionInformation (from @vscode/copilot-api).
 */
export interface IQuizExtensionInformation {
	/** Extension name */
	readonly name: string;
	/** Session ID */
	readonly sessionId: string;
	/** Machine ID */
	readonly machineId: string;
	/** Device ID */
	readonly deviceId: string;
	/** VS Code version */
	readonly vscodeVersion: string;
	/** Extension version */
	readonly version: string;
	/** Build type */
	readonly buildType: 'dev' | 'prod';
}

// #endregion

// #region Null implementation

/** Null QAPI client service for testing */
export class NullQuizQAPIClientService implements IQuizQAPIClientService {
	declare readonly _serviceBrand: undefined;
	readonly apiUrl: string | undefined = undefined;
	readonly telemetryUrl: string | undefined = undefined;
	readonly proxyUrl: string | undefined = undefined;

	async makeRequest<T>(_options: IQuizMakeRequestOptions, _metadata: QuizRequestMetadata): Promise<T> {
		return undefined as unknown as T;
	}

	updateDomains(_copilotToken: IQuizCopilotToken | undefined, _enterpriseUrlConfig?: string): IQuizDomainChangeResponse {
		return { capiUrlChanged: false, telemetryUrlChanged: false, dotcomUrlChanged: false, proxyUrlChanged: false };
	}
}

// #endregion
