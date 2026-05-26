/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/gitBranch.ts (normalizeBranchName utility)

/**
 * Normalize a generated branch name to be safe for Git.
 * Only supports alphanumeric characters and dashes for simplicity.
 */
export function quizNormalizeBranchName(branchName: string): string {
	// Only support alphanumeric characters and dashes for simplicity.
	let normalized = branchName.replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
	// Collapse consecutive dots (..) into a single dot
	normalized = normalized.replace(/\.{2,}/g, '.');
	// Strip leading '-' or '.'
	normalized = normalized.replace(/^[-.]+/, '');
	// Strip trailing '.' or '/'
	normalized = normalized.replace(/[./]+$/, '');
	// Strip trailing .lock
	normalized = normalized.replace(/\.lock$/, '');

	return normalized;
}
