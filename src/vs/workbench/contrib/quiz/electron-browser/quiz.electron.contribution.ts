/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerQuizNodeTools } from './quizNodeToolImpls.js';

export class QuizElectronContribution extends Disposable {

	static readonly ID = 'workbench.contrib.quizElectron';

	constructor(
		@ILogService logService: ILogService,
		@IFileService fileService: IFileService,
	) {
		super();
		logService.info('QuizElectronContribution: initialized');

		// Register node-layer tool implementations (override browser-layer with Node.js API access)
		registerQuizNodeTools(fileService, logService);
	}
}

registerWorkbenchContribution2(QuizElectronContribution.ID, QuizElectronContribution, WorkbenchPhase.AfterRestored);
