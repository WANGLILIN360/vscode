/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../../base/common/uuid.js';
import { getQuizToolName } from '../tools/quizToolNames.js';

// #region IQuizInternalToolReference (aligned with Copilot's InternalToolReference)

/**
 * Extended tool reference that includes an internal ID and optional pre-resolved input.
 * This is the internal representation used within Quiz's tool calling system,
 * as opposed to the external ChatLanguageModelToolReference seen by the API.
 */
export interface IQuizInternalToolReference {
	/** Stable unique ID for this tool reference within the current request */
	readonly id: string;
	/** The tool name (internal format, e.g., 'read_file' not 'quiz_readFile') */
	readonly name: string;
	/** Optional pre-resolved input parameters for the tool invocation */
	readonly input?: object;
}

// #endregion

// #region IQuizInternalToolReference factory (aligned with Copilot's InternalToolReference.from)

export namespace IQuizInternalToolReference {
	/**
	 * Creates an IQuizInternalToolReference from an external tool reference.
	 * Converts contributed tool names (e.g., 'quiz_readFile') to internal names (e.g., 'read_file').
	 */
	export function from(externalRef: { readonly name: string; readonly input?: object }): IQuizInternalToolReference {
		return {
			...externalRef,
			id: generateUuid(),
			name: getQuizToolName(externalRef.name),
		};
	}

	/**
	 * Creates an IQuizInternalToolReference with a specific internal tool name.
	 */
	export function create(name: string, input?: object): IQuizInternalToolReference {
		return {
			id: generateUuid(),
			name,
			input,
		};
	}
}

// #endregion

// #region IQuizToolGrouping (aligned with Copilot's IToolGrouping)

/**
 * Configuration for how tools should be grouped/virtualized in the prompt.
 * When a tool group is active, multiple individual tools are represented
 * as a single "virtual" tool in the prompt to reduce token usage.
 */
export interface IQuizToolGrouping {
	/** Map from virtual tool name to the set of real tool names it represents */
	readonly virtualToReal: ReadonlyMap<string, readonly string[]>;
	/** Map from real tool name to the virtual tool name it belongs to */
	readonly realToVirtual: ReadonlyMap<string, string>;
	/** Whether grouping is enabled */
	readonly enabled: boolean;
}

// #endregion
