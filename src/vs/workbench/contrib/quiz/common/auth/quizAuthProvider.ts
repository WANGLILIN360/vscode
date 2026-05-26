/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const IQuizAuthProvider = Symbol('IQuizAuthProvider');

export interface IQuizAuthProvider {
	getAuthToken(): Promise<string | undefined>;
	isAuthenticated(): Promise<boolean>;
}
