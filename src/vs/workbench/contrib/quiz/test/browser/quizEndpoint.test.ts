/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { QuizEndpointImpl } from '../../browser/endpoint/quizEndpointImpl.js';

suite('QuizEndpoint', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('should be available when endpoint URL is set', () => {
		const endpoint = new QuizEndpointImpl('https://api.example.com', new NullLogService());
		assert.strictEqual(endpoint.isAvailable(), true);
	});

	test('should not be available when endpoint URL is empty', () => {
		const endpoint = new QuizEndpointImpl('', new NullLogService());
		assert.strictEqual(endpoint.isAvailable(), false);
	});
});
