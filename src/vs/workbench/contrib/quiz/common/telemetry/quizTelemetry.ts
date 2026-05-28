/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizTelemetryService (aligned with Copilot's ITelemetryService + NullTelemetryService)

export const IQuizTelemetryService = createDecorator<IQuizTelemetryService>('quizTelemetryService');

/**
 * Telemetry service for Quiz. Bridges VS Code's ITelemetryService.
 * Aligned with Copilot's telemetry surface (NullTelemetryService, genAiAttributes).
 */
export interface IQuizTelemetryService {
	readonly _serviceBrand: undefined;

	reportRequest(params: IQuizTelemetryRequestParams): void;
	reportToolInvocation(params: IQuizTelemetryToolInvocationParams): void;
	reportError(params: IQuizTelemetryErrorParams): void;
}

export interface IQuizTelemetryRequestParams {
	readonly intent: string;
	readonly duration: number;
	readonly tokenCount?: number;
	readonly modelId?: string;
	readonly requestId?: string;
	readonly isQuotaExceeded?: boolean;
	readonly isRateLimited?: boolean;
}

export interface IQuizTelemetryToolInvocationParams {
	readonly toolName: string;
	readonly duration: number;
	readonly success: boolean;
	readonly requestId?: string;
}

export interface IQuizTelemetryErrorParams {
	readonly errorType: string;
	readonly message: string;
	readonly isExpected?: boolean;
	readonly requestId?: string;
}

// #endregion

// #region NullQuizTelemetryService (aligned with Copilot's NullTelemetryService)

/**
 * Null telemetry service that silently discards all events.
 * Aligned with Copilot's NullTelemetryService.
 */
export class NullQuizTelemetryService implements IQuizTelemetryService {
	declare readonly _serviceBrand: undefined;
	reportRequest(): void { }
	reportToolInvocation(): void { }
	reportError(): void { }
}

// #endregion
