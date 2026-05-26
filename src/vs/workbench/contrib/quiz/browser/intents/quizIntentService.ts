/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizIntent,
	IQuizIntentService,
} from '../../common/intents/quizIntents.js';

export class QuizIntentServiceImpl extends Disposable implements IQuizIntentService {

	_serviceBrand: undefined;

	private readonly _intents = new Map<string, IQuizIntent>();
	private readonly _onDidChangeIntents = this._register(new Emitter<void>());
	readonly onDidChangeIntents = this._onDidChangeIntents.event;

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	registerIntent(intent: IQuizIntent): IDisposable {
		this._intents.set(intent.id, intent);
		this._logService.info(`QuizIntentService: registered intent "${intent.id}"`);
		this._onDidChangeIntents.fire();
		return { dispose: () => { this._intents.delete(intent.id); this._onDidChangeIntents.fire(); } };
	}

	getIntent(id: string, location?: ChatAgentLocation): IQuizIntent | undefined {
		const intent = this._intents.get(id);
		if (intent && location !== undefined) {
			if (!intent.locations.includes(location)) {
				return undefined;
			}
		}
		return intent;
	}

	getIntents(location?: ChatAgentLocation): IQuizIntent[] {
		const all = Array.from(this._intents.values());
		if (location !== undefined) {
			return all.filter(i => i.locations.includes(location));
		}
		return all;
	}
}
