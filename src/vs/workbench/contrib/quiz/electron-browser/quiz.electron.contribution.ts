/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

export class QuizElectronContribution extends Disposable {

	static readonly ID = 'workbench.contrib.quizElectron';

	constructor(
		@ILogService logService: ILogService,
	) {
		super();
		logService.info('QuizElectronContribution: initialized');
	}
}

registerWorkbenchContribution2(QuizElectronContribution.ID, QuizElectronContribution, WorkbenchPhase.AfterRestored);
