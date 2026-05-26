/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IQuizWorkspaceContext } from '../../common/context/quizContextProvider.js';

export class QuizWorkspaceContextProvider {

	constructor(
		@IWorkspaceContextService private readonly _workspaceService: IWorkspaceContextService,
	) { }

	getContext(): IQuizWorkspaceContext {
		const folders = this._workspaceService.getWorkspace().folders;
		return {
			folders: folders.map(f => f.uri.toString()),
		};
	}
}
