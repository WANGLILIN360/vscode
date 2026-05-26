/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuizAuthProvider } from '../../common/auth/quizAuthProvider.js';

export class QuizNativeAuthProvider implements IQuizAuthProvider {

	async getAuthToken(): Promise<string | undefined> {
		// TODO: Implement native auth using keytar or secret storage
		return undefined;
	}

	async isAuthenticated(): Promise<boolean> {
		const token = await this.getAuthToken();
		return !!token;
	}
}
