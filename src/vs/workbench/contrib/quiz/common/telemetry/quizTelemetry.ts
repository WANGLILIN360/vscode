/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const IQuizTelemetryService = Symbol('IQuizTelemetryService');

export interface IQuizTelemetryService {
	reportRequest(params: IQuizTelemetryRequestParams): void;
}

export interface IQuizTelemetryRequestParams {
	readonly intent: string;
	readonly duration: number;
	readonly tokenCount?: number;
}
