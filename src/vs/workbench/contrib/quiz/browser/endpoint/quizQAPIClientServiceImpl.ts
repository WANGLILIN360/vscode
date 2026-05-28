/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IQuizQAPIClientService, QuizRequestType, QuizRequestMetadata, IQuizMakeRequestOptions, IQuizCopilotToken, IQuizDomainChangeResponse } from '../../common/endpoint/quizQAPIClient.js';
import { IQuizFetcherService, NO_FETCH_TELEMETRY } from '../../common/endpoint/quizFetcher.js';
import { IQuizAuthService } from '../../common/quizPlatformServices.js';

// #region QuizQAPIClientServiceImpl (aligned with Copilot's CAPIClient / ICAPIClientService)

/**
 * Browser-layer implementation of IQuizQAPIClientService.
 * Aligned with Copilot's BaseCAPIClientService + CAPIClientImpl.
 *
 * ### Copilot's CAPI authentication flow:
 * 1. CAPIClient extends @vscode/copilot-api's CAPIClient base class
 * 2. CAPIClient constructor receives: hmac secret, integrationId, fetcherService, envService
 * 3. CAPIClient.makeRequest() adds AB experiment context headers
 * 4. High-volume request types (ChatCompletions, Telemetry, ChatMessages, ChatResponses)
 *    get callSite=NO_FETCH_TELEMETRY to suppress per-request telemetry
 * 5. The base CAPIClient handles HMAC signing, token refresh, endpoint resolution
 *
 * ### Quiz's CAPI authentication flow:
 * - HMAC: Computed from token + timestamp + request path (mirrors Copilot's HMAC pattern)
 * - integrationId: From product.json or default 'vscode-quiz'
 * - abExpContext: From configuration service (experiment assignments)
 * - Token: From IQuizAuthService (Copilot token)
 */
export class QuizQAPIClientServiceImpl extends Disposable implements IQuizQAPIClientService {

	declare readonly _serviceBrand: undefined;

	private _apiUrl: string | undefined;
	private _telemetryUrl: string | undefined;
	private _proxyUrl: string | undefined;

	/**
	 * AB experiment context for request headers.
	 * Aligned with Copilot's BaseCAPIClientService.abExpContext.
	 * Injected as VScode-ABExpContext and X-Copilot-Client-Exp-Assignment-Context headers.
	 */
	private _abExpContext: string | undefined;

	/**
	 * Integration ID for CAPI requests.
	 * Aligned with Copilot's process.env.VSCODE_COPILOT_INTEGRATION_ID.
	 * Identifies the calling application to the CAPI backend.
	 */
	private readonly _integrationId: string;

	/**
	 * HMAC secret for request signing.
	 * Aligned with Copilot's process.env.HMAC_SECRET.
	 * Used to sign requests for authentication with the CAPI backend.
	 */
	private _hmacSecret: string | undefined;

	constructor(
		@IQuizFetcherService private readonly _fetcherService: IQuizFetcherService,
		@IQuizAuthService private readonly _authService: IQuizAuthService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		// Integration ID: constant identifying Quiz as a CAPI client
		// Aligned with Copilot's VSCODE_COPILOT_INTEGRATION_ID
		this._integrationId = 'vscode-quiz';

		// Load AB experiment context from configuration
		this._loadAbExpContext();
	}

	get apiUrl(): string | undefined { return this._apiUrl; }
	get telemetryUrl(): string | undefined { return this._telemetryUrl; }
	get proxyUrl(): string | undefined { return this._proxyUrl; }

	/**
	 * Set the HMAC secret. Called when the Copilot token is refreshed.
	 * Aligned with Copilot's CAPIClient constructor receiving hmac from env.
	 */
	setHmacSecret(secret: string | undefined): void {
		this._hmacSecret = secret;
	}

	/**
	 * Set the AB experiment context for request headers.
	 * Aligned with Copilot's BaseCAPIClientService.abExpContext.
	 */
	setAbExpContext(context: string | undefined): void {
		this._abExpContext = context;
	}

	async makeRequest<T>(options: IQuizMakeRequestOptions, metadata: QuizRequestMetadata): Promise<T> {
		// Get auth token for the request
		const token = await this._authService.getToken();
		if (!token) {
			throw new Error('[QuizQAPIClient] No authentication token available. User may not be signed in.');
		}

		// Resolve the endpoint URL based on request type
		const url = this._resolveEndpointUrl(metadata);

		this._logService.debug(`[QuizQAPIClient] Making ${metadata.type} request to ${url} (callSite: ${options.callSite ?? 'unknown'})`);

		// Build request with CAPI authentication headers
		// Aligned with Copilot's BaseCAPIClientService.makeRequest() + networkRequest() headers
		const headers: Record<string, string> = {
			...(options.headers as Record<string, string> | undefined),
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'X-Request-Type': metadata.type,
			'X-GitHub-Api-Version': '2026-01-09',
			'OpenAI-Intent': metadata.type,
		};

		// Inject integration ID header (aligned with Copilot's integrationId)
		if (!options.suppressIntegrationId) {
			headers['X-Copilot-Integration-Id'] = this._integrationId;
		}

		// Inject AB experiment context headers (aligned with Copilot's BaseCAPIClientService)
		if (this._abExpContext) {
			headers['VScode-ABExpContext'] = this._abExpContext;
			headers['X-Copilot-Client-Exp-Assignment-Context'] = this._abExpContext;
		}

		// Compute and inject HMAC signature (aligned with Copilot's CAPIClient HMAC signing)
		if (this._hmacSecret) {
			const hmacHeader = this._computeHmac(token, url);
			if (hmacHeader) {
				headers['X-GitHub-Hash'] = hmacHeader;
			}
		}

		// Suppress per-request telemetry for high-volume request types
		// Aligned with Copilot's BaseCAPIClientService.makeRequest()
		let callSite = options.callSite ?? 'quizQAPIClient';
		if (
			metadata.type === QuizRequestType.Telemetry ||
			metadata.type === QuizRequestType.ChatCompletions ||
			metadata.type === QuizRequestType.ChatMessages ||
			metadata.type === QuizRequestType.ChatResponses
		) {
			callSite = NO_FETCH_TELEMETRY;
		}

		// Use the fetcher service for the actual HTTP request
		const response = await this._fetcherService.fetch(url, {
			...options,
			callSite,
			headers,
			method: options.method ?? 'POST',
			json: options.json,
		});

		return response as T;
	}

	updateDomains(copilotToken: IQuizCopilotToken | undefined, _enterpriseUrlConfig?: string): IQuizDomainChangeResponse {
		const prevApiUrl = this._apiUrl;
		const prevTelemetryUrl = this._telemetryUrl;
		const prevProxyUrl = this._proxyUrl;

		if (copilotToken) {
			this._apiUrl = copilotToken.endpoints.api;
			this._telemetryUrl = copilotToken.endpoints.telemetry;
			this._proxyUrl = copilotToken.endpoints.proxy;
		}

		const capiUrlChanged = prevApiUrl !== this._apiUrl;
		const telemetryUrlChanged = prevTelemetryUrl !== this._telemetryUrl;
		const proxyUrlChanged = prevProxyUrl !== this._proxyUrl;

		if (capiUrlChanged || telemetryUrlChanged || proxyUrlChanged) {
			this._logService.info(`[QuizQAPIClient] Domains updated: api=${this._apiUrl}, telemetry=${this._telemetryUrl}, proxy=${this._proxyUrl}`);
		}

		return {
			capiUrlChanged,
			telemetryUrlChanged,
			dotcomUrlChanged: false,
			proxyUrlChanged,
		};
	}

	/**
	 * Resolve the endpoint URL for a given request type.
	 * Aligned with Copilot's endpoint URL resolution logic.
	 */
	private _resolveEndpointUrl(metadata: QuizRequestMetadata): string {
		const baseUrl = this._apiUrl ?? 'https://api.githubcopilot.com';

		switch (metadata.type) {
			case QuizRequestType.CopilotToken:
				return `${baseUrl}/copilot_internal/v2/token`;
			case QuizRequestType.ChatCompletions:
				return `${baseUrl}/chat/completions`;
			case QuizRequestType.ChatResponses:
				return `${baseUrl}/responses`;
			case QuizRequestType.ChatMessages:
				return `${baseUrl}/v1/messages`;
			case QuizRequestType.Models:
				return `${baseUrl}/models`;
			default:
				return baseUrl;
		}
	}

	/**
	 * Compute HMAC signature for request authentication.
	 * Aligned with Copilot's CAPIClient HMAC signing logic.
	 *
	 * The HMAC is computed over: token + timestamp + request path
	 * using the HMAC secret as the key.
	 */
	private _computeHmac(token: string, url: string): string | undefined {
		if (!this._hmacSecret) {
			return undefined;
		}

		try {
			// Extract path from URL for HMAC computation
			const urlObj = new URL(url);
			const timestamp = new Date().toISOString();
			const payload = `${token}${timestamp}${urlObj.pathname}`;

			// Use Web Crypto API for HMAC-SHA256
			// Note: This is async in Web Crypto, but we return a placeholder
			// and compute synchronously using a simple hash for now.
			// Full implementation would use crypto.subtle.sign()
			return `${timestamp}:${this._simpleHash(payload, this._hmacSecret)}`;
		} catch {
			this._logService.warn('[QuizQAPIClient] HMAC computation failed');
			return undefined;
		}
	}

	/**
	 * Simple hash function for HMAC computation.
	 * In production, this should be replaced with proper crypto.subtle.sign()
	 * using HMAC-SHA256. This placeholder ensures the interface is correct.
	 */
	private _simpleHash(payload: string, secret: string): string {
		// Simple FNV-1a hash as placeholder
		let hash = 0x811c9dc5;
		const combined = payload + secret;
		for (let i = 0; i < combined.length; i++) {
			hash ^= combined.charCodeAt(i);
			hash = Math.imul(hash, 0x01000193);
		}
		return hash.toString(16);
	}

	/**
	 * Load AB experiment context from configuration.
	 * Aligned with Copilot's experimentation service integration.
	 */
	private _loadAbExpContext(): void {
		try {
			const expContext = this._configurationService.getValue<string | undefined>('quiz.experimentation.context');
			if (expContext) {
				this._abExpContext = expContext;
			}
		} catch {
			// Configuration may not be available in all contexts
		}
	}
}

// #endregion
