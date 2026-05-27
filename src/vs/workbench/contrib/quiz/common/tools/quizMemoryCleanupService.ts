/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/memoryCleanupService.ts
// Layer: common — contains only the interface and service identifier.
// Implementation moved to browser/tools/quizMemoryCleanupServiceImpl.ts to comply with
// the four-layer architecture (common/ must not contain DI-injected classes).

import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizMemoryCleanupService = createDecorator<IQuizMemoryCleanupService>('quizMemoryCleanupService');

/**
 * Service that manages cleanup of stale memory files.
 * Tracks access times and periodically removes files older than the retention period.
 * Aligned with Copilot's IMemoryCleanupService.
 */
export interface IQuizMemoryCleanupService {
	readonly _serviceBrand: undefined;

	/** Marks a memory resource as recently accessed. */
	markAccessed(uri: URI): void;

	/** Starts the cleanup scheduler if not already running. */
	start(): void;

	/** Checks if a URI is within the memory storage directory. */
	isMemoryUri(uri: URI): boolean;
}
