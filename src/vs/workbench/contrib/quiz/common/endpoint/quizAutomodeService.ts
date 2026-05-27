/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's automode system:
//   platform/endpoint/common/automodeService.ts — IAutomodeService interface
//   platform/endpoint/node/automodeService.ts   — AutomodeService implementation
//   platform/endpoint/node/autoChatEndpoint.ts  — AutoChatEndpoint
//
// This file provides the common/ layer types for Quiz.
// Pure types — no DI, no platform API (common/ layer).

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizEndpoint } from './quizEndpoint.js';

// #region IQuizAutomodeService (aligned with Copilot's IAutomodeService)

export const IQuizAutomodeService = createDecorator<IQuizAutomodeService>('quizAutomodeService');

/**
 * Service for resolving the endpoint to use when the user selects "auto" mode.
 * In Copilot, this involves calling the AutoModels CAPI to get a session token
 * with available models, optionally using a router model to pick the best one.
 *
 * Aligned with Copilot's IAutomodeService (platform/endpoint/common/automodeService.ts).
 *
 * The implementation lives in the browser/ or electron-browser/ layer.
 */
export interface IQuizAutomodeService {
	readonly _serviceBrand: undefined;

	/**
	 * Resolve the endpoint to use for an auto-mode request.
	 * Returns an IQuizEndpoint configured for the selected model.
	 *
	 * Aligned with Copilot's IAutomodeService.resolveAutoModeEndpoint.
	 */
	resolveAutoModeEndpoint(chatSessionId: string, knownEndpoints: readonly IQuizEndpoint[]): Promise<IQuizEndpoint>;

	/**
	 * Marks the router cache for this conversation as needing re-evaluation.
	 * The next call to resolveAutoModeEndpoint will re-run the router
	 * instead of returning the cached endpoint.
	 *
	 * Aligned with Copilot's IAutomodeService.invalidateRouterCache.
	 */
	invalidateRouterCache(chatSessionId: string): void;
}

// #endregion

// #region Auto mode API response (aligned with Copilot's AutoModeAPIResponse)

/**
 * Response from the AutoModels CAPI endpoint.
 * Contains the list of available models, an expiration timestamp,
 * and a session token for subsequent requests.
 *
 * Aligned with Copilot's AutoModeAPIResponse (platform/endpoint/node/automodeService.ts).
 */
export interface IQuizAutoModeAPIResponse {
	readonly available_models: string[];
	readonly expires_at: number;
	readonly session_token: string;
	readonly discounted_costs?: Record<string, number>;
}

// #endregion

// #region Router decision types (aligned with Copilot's RouterDecisionFetcher types)

/**
 * Context signals provided to the router for model selection.
 * Aligned with Copilot's RoutingContextSignals (platform/endpoint/node/routerDecisionFetcher.ts).
 */
export interface IQuizRoutingContextSignals {
	readonly session_id?: string;
	readonly reference_count?: number;
	readonly prompt_char_count?: number;
	readonly previous_model?: string;
	readonly turn_number?: number;
}

/**
 * Result from the router decision fetcher.
 * Aligned with Copilot's RouterDecisionResult (platform/endpoint/node/routerDecisionFetcher.ts).
 */
export interface IQuizRouterDecisionResult {
	/** Whether the router fell back to default selection */
	readonly fallback: boolean;
	/** Reason for fallback, if applicable */
	readonly fallback_reason?: string;
	/** Ranked list of candidate model names from the router */
	readonly candidate_models: string[];
	/** Routing method used (e.g. 'llm', 'ab') */
	readonly routing_method?: string;
	/** Router confidence score (0-1) */
	readonly confidence: number;
	/** Predicted label from the router */
	readonly predicted_label?: string;
	/** Whether a sticky routing override was applied */
	readonly sticky_override?: boolean;
}

// #endregion

// #region Null implementation

/**
 * Null implementation of IQuizAutomodeService that returns the first known endpoint.
 */
export class NullQuizAutomodeService implements IQuizAutomodeService {
	declare readonly _serviceBrand: undefined;

	async resolveAutoModeEndpoint(_chatSessionId: string, knownEndpoints: readonly IQuizEndpoint[]): Promise<IQuizEndpoint> {
		if (!knownEndpoints.length) {
			throw new Error('No endpoints available for auto mode.');
		}
		return knownEndpoints[0];
	}

	invalidateRouterCache(_chatSessionId: string): void { /* no-op */ }
}

// #endregion
