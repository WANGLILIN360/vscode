/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IQuizAuthProvider, IQuizTokenClaims } from '../../common/auth/quizAuthProvider.js';
import { Event } from '../../../../../base/common/event.js';

export class QuizAuthProviderImpl implements IQuizAuthProvider {

	declare _serviceBrand: undefined;

	onDidChangeAuthentication = Event.None;

	async refreshToken(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	getTokenClaims(): IQuizTokenClaims | undefined {
		throw new Error('Method not implemented.');
	}

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
