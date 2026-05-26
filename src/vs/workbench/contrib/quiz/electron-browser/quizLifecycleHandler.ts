/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export class QuizLifecycleHandler extends Disposable {

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._logService.info('QuizLifecycleHandler: initialized');
	}
}
