/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/intentRegistry.ts

import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { IQuizIntent } from '../intents/quizIntents.js';

export interface IQuizCommandDetails {
	commandId: string;
	intent?: IQuizIntent;
	details: string;
	locations: ChatAgentLocation[];
	readonly toolEquivalent?: string;
}

export const QuizIntentRegistry = new class {
	private _descriptors: IQuizCommandDetails[] = [];

	public setIntents(intentDescriptors: IQuizCommandDetails[]) {
		this._descriptors = this._descriptors.concat(intentDescriptors);
	}

	public getIntents(): readonly IQuizCommandDetails[] {
		return this._descriptors;
	}
}();
