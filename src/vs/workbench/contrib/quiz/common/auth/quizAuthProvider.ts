/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizAuthProvider (aligned with Copilot's CopilotToken / auth)

export const IQuizAuthProvider = createDecorator<IQuizAuthProvider>('quizAuthProvider');

/**
 * Authentication provider for Quiz. Bridges VS Code's authentication API.
 * Aligned with Copilot's CopilotToken (platform/auth/common/copilotToken.ts).
 *
 * For the full service interface with token refresh and claims, see
 * IQuizAuthService in quizPlatformServices.ts.
 */
export interface IQuizAuthProvider {
	readonly _serviceBrand: undefined;

	getAuthToken(): Promise<string | undefined>;
	isAuthenticated(): Promise<boolean>;

	/** Fires when authentication state changes */
	readonly onDidChangeAuthentication: Event<boolean>;

	/** Refresh the authentication token */
	refreshToken(): Promise<void>;

	/** Get parsed token claims (e.g., user info, scopes, expiry) */
	getTokenClaims(): IQuizTokenClaims | undefined;
}

export interface IQuizTokenClaims {
	readonly sub?: string;
	readonly tid?: string;
	readonly scope?: string;
	readonly exp?: number;
	readonly iat?: number;
}

// #endregion
