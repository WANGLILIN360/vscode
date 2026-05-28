/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizChatQuotaService } from '../../common/chat/quizChatTypes.js';

// #region QuizChatQuotaServiceImpl (aligned with Copilot's ChatQuotaService)

/**
 * Browser-layer implementation of IQuizChatQuotaService.
 * Processes quota-related headers from CAPI responses and tracks quota state.
 * Aligned with Copilot's ChatQuotaService.
 */
export class QuizChatQuotaServiceImpl extends Disposable implements IQuizChatQuotaService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeQuota = this._register(new Emitter<void>());
	readonly onDidChangeQuota: Event<void> = this._onDidChangeQuota.event;

	private _isQuotaExceeded = false;
	private _quotaResetDate: string | undefined;
	private _rateLimitRemaining: number | undefined;
	private _rateLimitLimit: number | undefined;

	get isQuotaExceeded(): boolean { return this._isQuotaExceeded; }
	get quotaResetDate(): string | undefined { return this._quotaResetDate; }
	get rateLimitRemaining(): number | undefined { return this._rateLimitRemaining; }
	get rateLimitLimit(): number | undefined { return this._rateLimitLimit; }

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	/**
	 * Process quota-related headers from a CAPI response.
	 * Aligned with Copilot's ChatQuotaService.processQuotaHeaders().
	 *
	 * Key headers:
	 * - X-RateLimit-Limit: Maximum requests allowed
	 * - X-RateLimit-Remaining: Remaining requests
	 * - X-RateLimit-Reset: Reset timestamp
	 * - X-Quota-Reset-Date: Date when quota resets
	 * - X-Quota-Exceeded: Whether quota is exceeded
	 */
	processQuotaHeaders(headers: Headers): void {
		const prevExceeded = this._isQuotaExceeded;
		const prevResetDate = this._quotaResetDate;

		// Process rate limit headers
		const rateLimitLimit = headers.get('x-ratelimit-limit');
		const rateLimitRemaining = headers.get('x-ratelimit-remaining');
		const rateLimitReset = headers.get('x-ratelimit-reset');

		if (rateLimitLimit) {
			this._rateLimitLimit = parseInt(rateLimitLimit, 10);
		}
		if (rateLimitRemaining) {
			this._rateLimitRemaining = parseInt(rateLimitRemaining, 10);
		}

		// Process quota exceeded header
		const quotaExceeded = headers.get('x-quota-exceeded');
		if (quotaExceeded) {
			this._isQuotaExceeded = quotaExceeded.toLowerCase() === 'true';
		}

		// Process quota reset date
		const quotaResetDate = headers.get('x-quota-reset-date');
		if (quotaResetDate) {
			this._quotaResetDate = quotaResetDate;
		} else if (rateLimitReset) {
			// Fallback: derive reset date from rate limit reset timestamp
			try {
				const resetTs = parseInt(rateLimitReset, 10);
				if (!isNaN(resetTs)) {
					this._quotaResetDate = new Date(resetTs * 1000).toISOString();
				}
			} catch {
				// Ignore invalid timestamp
			}
		}

		// Detect quota exceeded from remaining count
		if (this._rateLimitRemaining !== undefined && this._rateLimitRemaining <= 0) {
			this._isQuotaExceeded = true;
		}

		// Detect quota recovery
		if (prevExceeded && !this._isQuotaExceeded) {
			this._logService.info('[QuizQuota] Quota recovered');
		}

		// Fire change event if state changed
		if (prevExceeded !== this._isQuotaExceeded || prevResetDate !== this._quotaResetDate) {
			this._onDidChangeQuota.fire();
		}

		if (this._isQuotaExceeded) {
			this._logService.warn(`[QuizQuota] Quota exceeded. Reset: ${this._quotaResetDate ?? 'unknown'}`);
		}
	}

	/**
	 * Reset quota state (e.g., on sign-out).
	 */
	reset(): void {
		this._isQuotaExceeded = false;
		this._quotaResetDate = undefined;
		this._rateLimitRemaining = undefined;
		this._rateLimitLimit = undefined;
		this._onDidChangeQuota.fire();
	}
}

// #endregion
