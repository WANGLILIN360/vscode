/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuizResponseDelta } from '../../common/endpoint/quizEndpoint.js';

export interface IChatProgress {
	kind: string;
	content?: unknown;
}

export class QuizProgressAdapter {

	adapt(chunk: IQuizResponseDelta): IChatProgress[] {
		const progress: IChatProgress[] = [];

		if (chunk.text) {
			progress.push({
				kind: 'markdownContent',
				content: chunk.text,
			});
		}

		return progress;
	}
}
