/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IQuizTelemetryRequestParams, IQuizTelemetryService } from '../../common/telemetry/quizTelemetry.js';

export class QuizTelemetryServiceImpl implements IQuizTelemetryService {

	constructor(
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
	) { }

	reportRequest(params: IQuizTelemetryRequestParams): void {
		this._telemetryService.publicLog('quiz/request', {
			intent: params.intent,
			duration: params.duration,
			tokenCount: params.tokenCount,
		});
	}
}
