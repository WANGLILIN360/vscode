/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizQAPIClientService, type IQuizCopilotToken, type IQuizDomainChangeResponse } from './quizQAPIClient.js';

// #region IQuizDomainChangeEvent (aligned with Copilot's IDomainChangeEvent)

/**
 * Event fired when CAPI domain URLs change.
 * Aligned with Copilot's IDomainChangeEvent (platform/endpoint/common/domainService.ts).
 */
export interface IQuizDomainChangeEvent {
	readonly capiUrlChanged: boolean;
	readonly telemetryUrlChanged: boolean;
	readonly dotcomUrlChanged: boolean;
	readonly proxyUrlChanged: boolean;
}

// #endregion

// #region IQuizDomainService (aligned with Copilot's IDomainService)

export const IQuizDomainService = createDecorator<IQuizDomainService>('quizDomainService');

/**
 * Domain URL management service for the CAPI SDK path.
 * Aligned with Copilot's IDomainService (platform/endpoint/common/domainService.ts).
 *
 * This service tracks and propagates changes to CAPI endpoint URLs:
 * - **api.githubcopilot.com** — main CAPI endpoint for chat completions, responses, models
 * - **telemetry** — Copilot telemetry endpoint
 * - **proxy** — Copilot proxy endpoint (for xtab, etc.)
 * - **dotcom** — GitHub.com API endpoint (for GHE)
 *
 * ### Why this matters now that Quiz has QAPI:
 *
 * Copilot's `DomainServiceImpl` listens for:
 * 1. Copilot token refreshes → token contains new `endpoints` URLs
 * 2. Configuration changes → `copilot.advanced.debugOverrideCAPIUrl`, enterprise URL
 *
 * When URLs change, it calls `ICAPIClientService.updateDomains()` and fires
 * `onDidChangeDomains` so other services (auth, endpoint provider) can react.
 *
 * Quiz's `QuizQAPIClientServiceImpl.updateDomains()` already handles the
 * URL update, but there's no central event to notify other consumers.
 * This service fills that gap.
 *
 * ### Flow (mirroring Copilot):
 * ```
 * Token refresh → IQuizDomainService.processCopilotToken()
 *   → IQuizQAPIClientService.updateDomains()
 *   → IQuizDomainChangeEvent fires
 *     → Auth service re-checks session
 *     → Endpoint provider refreshes model list
 *     → UI updates degradation status
 * ```
 */
export interface IQuizDomainService {
	readonly _serviceBrand: undefined;

	/** Fires when any CAPI domain URL changes */
	readonly onDidChangeDomains: Event<IQuizDomainChangeEvent>;

	/** Current CAPI API URL */
	readonly capiUrl: string | undefined;

	/** Current telemetry URL */
	readonly telemetryUrl: string | undefined;

	/** Current proxy URL */
	readonly proxyUrl: string | undefined;

	/**
	 * Process a new Copilot token and update domains if they changed.
	 * Aligned with Copilot's DomainServiceImpl._processCopilotToken().
	 *
	 * Called when:
	 * - The auth service refreshes the Copilot token
	 * - The token store updates with a new token
	 *
	 * @param token The new Copilot token (may contain updated endpoint URLs)
	 */
	processCopilotToken(token: IQuizCopilotToken | undefined): void;

	/**
	 * Apply configuration overrides to the current domains.
	 * Aligned with Copilot's DomainServiceImpl._onDidConfigChangeHandler().
	 *
	 * Called when:
	 * - User changes `copilot.advanced.debugOverrideCAPIUrl`
	 * - Enterprise URL configuration changes
	 *
	 * @param capiOverride Override URL for the CAPI endpoint
	 * @param proxyOverride Override URL for the proxy endpoint
	 * @param enterpriseUrl Enterprise URL (for GHE scenarios)
	 */
	applyConfigOverrides(capiOverride: string | undefined, proxyOverride: string | undefined, enterpriseUrl?: string): void;
}

// #endregion

// #region QuizDomainServiceImpl (aligned with Copilot's DomainServiceImpl)

/**
 * Implementation of IQuizDomainService.
 * Bridges VS Code's configuration and auth services with the QAPI client.
 * Aligned with Copilot's DomainServiceImpl (platform/endpoint/node/domainServiceImpl.ts).
 */
export class QuizDomainServiceImpl extends Disposable implements IQuizDomainService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeDomains = this._register(new Emitter<IQuizDomainChangeEvent>());
	readonly onDidChangeDomains: Event<IQuizDomainChangeEvent> = this._onDidChangeDomains.event;

	private _capiUrl: string | undefined;
	private _telemetryUrl: string | undefined;
	private _proxyUrl: string | undefined;

	constructor(
		@IQuizQAPIClientService private readonly _qapiClientService: IQuizQAPIClientService,
	) {
		super();
	}

	get capiUrl(): string | undefined { return this._capiUrl; }
	get telemetryUrl(): string | undefined { return this._telemetryUrl; }
	get proxyUrl(): string | undefined { return this._proxyUrl; }

	processCopilotToken(token: IQuizCopilotToken | undefined): void {
		this._updateDomains(token);
	}

	applyConfigOverrides(capiOverride: string | undefined, proxyOverride: string | undefined, _enterpriseUrl?: string): void {
		// If no overrides, nothing to do
		if (!capiOverride && !proxyOverride) {
			return;
		}

		// Build a synthetic token with override URLs applied
		// Aligned with Copilot's DomainServiceImpl._processCAPIModuleChange()
		const syntheticToken: IQuizCopilotToken = {
			endpoints: {
				api: capiOverride,
				proxy: proxyOverride,
			},
			sku: 'unknown',
		};

		this._updateDomains(syntheticToken);
	}

	private _updateDomains(token: IQuizCopilotToken | undefined): void {
		const result: IQuizDomainChangeResponse = this._qapiClientService.updateDomains(token);

		// Update local state from QAPI client (source of truth for URLs)
		this._capiUrl = this._qapiClientService.apiUrl;
		this._telemetryUrl = this._qapiClientService.telemetryUrl;
		this._proxyUrl = this._qapiClientService.proxyUrl;

		// Fire event if any URL changed
		if (result.capiUrlChanged || result.telemetryUrlChanged || result.dotcomUrlChanged || result.proxyUrlChanged) {
			this._onDidChangeDomains.fire({
				capiUrlChanged: result.capiUrlChanged,
				telemetryUrlChanged: result.telemetryUrlChanged,
				dotcomUrlChanged: result.dotcomUrlChanged,
				proxyUrlChanged: result.proxyUrlChanged,
			});
		}
	}
}

// #endregion

// #region Null implementation

/** Null domain service for testing */
export class NullQuizDomainService implements IQuizDomainService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeDomains = Event.None;
	readonly capiUrl: string | undefined = undefined;
	readonly telemetryUrl: string | undefined = undefined;
	readonly proxyUrl: string | undefined = undefined;

	processCopilotToken(): void { }
	applyConfigOverrides(): void { }
}

// #endregion
