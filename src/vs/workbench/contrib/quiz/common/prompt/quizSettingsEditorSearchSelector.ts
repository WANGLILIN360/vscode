/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/settingsEditorSearchResultsSelector.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizSettingsEditorSearchSelector = createDecorator<IQuizSettingsEditorSearchSelector>('quizSettingsEditorSearchSelector');

export interface IQuizSettingsEditorSearchSelector {
	readonly _serviceBrand: undefined;

	/**
	 * Select the top search results for a settings editor query.
	 */
	selectTopSearchResults(
		query: string,
		settings: IQuizSettingListItem[],
		token: CancellationToken,
	): Promise<string[]>;
}

export interface IQuizSettingListItem {
	readonly key: string;
	readonly label?: string;
	readonly description?: string;
}

/**
 * Null implementation.
 */
export class NullQuizSettingsEditorSearchSelector implements IQuizSettingsEditorSearchSelector {
	declare readonly _serviceBrand: undefined;

	async selectTopSearchResults(_query: string, _settings: IQuizSettingListItem[], _token: CancellationToken): Promise<string[]> {
		return [];
	}
}
