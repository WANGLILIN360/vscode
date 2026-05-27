/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/memoryCleanupService.ts
// Layer: browser — DI-injected implementation of IQuizMemoryCleanupService.
// Moved from common/ to comply with the four-layer architecture rules.

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IQuizMemoryCleanupService } from '../../common/tools/quizMemoryCleanupService.js';

/**
 * Retention period in milliseconds (14 days).
 */
const RETENTION_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Base directory for memory storage.
 */
const MEMORY_BASE_DIR = 'memory-tool/memories';

export class QuizMemoryCleanupService extends Disposable implements IQuizMemoryCleanupService {
	declare readonly _serviceBrand: undefined;

	private readonly baseStorageUri: URI | undefined;
	private readonly globalBaseStorageUri: URI | undefined;
	private readonly accessTimestamps = new ResourceMap<number>();
	private started = false;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();

		// Use workspace storage URI for session/repo-scoped memory
		const workspaceStorageUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		this.baseStorageUri = workspaceStorageUri
			? URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR)
			: undefined;

		// Use global storage for user-scoped memory
		// In VS Code core, we use the storageService's default storage path
		this.globalBaseStorageUri = this.baseStorageUri;
	}

	override dispose(): void {
		super.dispose();
	}

	markAccessed(uri: URI): void {
		this.accessTimestamps.set(uri, Date.now());
	}

	isMemoryUri(uri: URI): boolean {
		if (this.baseStorageUri) {
			const basePath = this.baseStorageUri.path.toLowerCase();
			const uriPath = uri.path.toLowerCase();
			if (uri.scheme === this.baseStorageUri.scheme && uriPath.startsWith(basePath)) {
				return true;
			}
		}
		if (this.globalBaseStorageUri) {
			const basePath = this.globalBaseStorageUri.path.toLowerCase();
			const uriPath = uri.path.toLowerCase();
			if (uri.scheme === this.globalBaseStorageUri.scheme && uriPath.startsWith(basePath)) {
				return true;
			}
		}
		return false;
	}

	start(): void {
		if (this.started) {
			return;
		}
		this.started = true;

		// Run cleanup on startup (in background)
		this.cleanupStaleResources().catch(() => {
			// Cleanup errors are non-fatal
		});
	}

	private async cleanupStaleResources(): Promise<void> {
		if (!this.baseStorageUri) {
			return;
		}

		try {
			// Check if base directory exists
			try {
				const stat = await this.fileService.resolve(this.baseStorageUri);
				if (!stat.isDirectory) {
					return;
				}
			} catch {
				// Directory doesn't exist, nothing to clean up
				return;
			}

			const now = Date.now();
			const cutoffTime = now - RETENTION_PERIOD_MS;

			// Read all session directories (exclude 'repo' which is managed separately)
			const entries = await this.fileService.resolve(this.baseStorageUri);
			if (!entries.children) {
				return;
			}

			const sessionDirs = entries.children.filter(child => child.isDirectory && child.name !== 'repo');

			for (const sessionDir of sessionDirs) {
				await this.cleanupSessionDirectory(sessionDir.resource, cutoffTime);
			}

			// Clean up empty session directories
			for (const sessionDir of sessionDirs) {
				try {
					const sessionStat = await this.fileService.resolve(sessionDir.resource);
					if (sessionStat.children && sessionStat.children.length === 0) {
						await this.fileService.del(sessionDir.resource, { recursive: true });
					}
				} catch {
					// Ignore errors when checking/deleting empty directories
				}
			}
		} catch {
			// Error during cleanup is non-fatal
		}
	}

	private async cleanupSessionDirectory(sessionUri: URI, cutoffTime: number): Promise<void> {
		try {
			const stat = await this.fileService.resolve(sessionUri);
			if (!stat.children) {
				return;
			}

			for (const child of stat.children) {
				const entryUri = child.resource;

				// Check in-memory timestamp first
				const accessTime = this.accessTimestamps.get(entryUri);
				if (accessTime && accessTime >= cutoffTime) {
					continue; // Still fresh
				}

				// Fall back to file system mtime
				try {
					const childStat = await this.fileService.stat(entryUri);
					if (childStat.mtime >= cutoffTime) {
						this.accessTimestamps.set(entryUri, childStat.mtime);
						continue; // Still fresh
					}
				} catch {
					// If we can't stat, assume it's stale
				}

				// Delete stale entry
				try {
					await this.fileService.del(entryUri, { recursive: child.isDirectory });
					this.accessTimestamps.delete(entryUri);
				} catch {
					// Failed to delete is non-fatal
				}
			}
		} catch {
			// Error cleaning session directory is non-fatal
		}
	}
}
