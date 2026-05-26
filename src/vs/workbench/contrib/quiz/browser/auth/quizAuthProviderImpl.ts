/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IQuizAuthProvider } from '../../common/auth/quizAuthProvider.js';

export class QuizAuthProviderImpl implements IQuizAuthProvider {

	constructor(
		@IAuthenticationService _authService: IAuthenticationService,
	) { }

	async getAuthToken(): Promise<string | undefined> {
		// TODO: Implement actual auth flow
		return undefined;
	}

	async isAuthenticated(): Promise<boolean> {
		const token = await this.getAuthToken();
		return !!token;
	}
}
