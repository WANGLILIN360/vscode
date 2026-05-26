/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { QuizConversation, QuizTurnImpl } from '../../common/prompt/quizConversation.js';

suite('QuizService', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('QuizConversation should manage turns', () => {
		const conversation = new QuizConversation('test-session');
		const turn = new QuizTurnImpl('1', { message: 'Hello', type: 'user', isContinuation: false });

		conversation.addTurn(turn);

		assert.strictEqual(conversation.turns.length, 1);
		assert.strictEqual(conversation.getLatestTurn()?.id, '1');
	});
});
