/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Shared binary file detection and hexdump utilities.
// Used by both browser-layer and node-layer ReadFile tool implementations.
// Aligned with Copilot's binary detection and hexdump formatting.

export const MAX_OUTPUT_LINES = 2000;
export const MAX_LINE_LENGTH = 2000;
export const MAX_HEXDUMP_BYTES = 512;

// Known binary extensions that may not contain null bytes
export const knownBinaryExtensions = new Set([
	'.pdf', '.zip', '.gz', '.tar', '.exe', '.dll', '.so', '.dylib',
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.wav',
	'.mp3', '.mp4', '.avi', '.mov', '.class', '.o', '.pyc', '.woff',
	'.woff2', '.eot', '.ttf', '.otf',
]);

/**
 * Check if content appears to be binary by looking for null bytes.
 * Aligned with Copilot's isBinaryContent check.
 */
export function isBinaryContent(data: Uint8Array): boolean {
	// Check first 8KB for null bytes
	const checkLength = Math.min(data.length, 8192);
	for (let i = 0; i < checkLength; i++) {
		if (data[i] === 0) {
			return true;
		}
	}
	return false;
}

/**
 * Format binary data as a hexdump (aligned with Copilot's formatHexdump).
 */
export function formatHexdump(data: Uint8Array, startByte: number, length: number): string {
	const lines: string[] = [];
	const end = Math.min(startByte + length, data.length);
	for (let offset = startByte; offset < end; offset += 16) {
		const chunk = data.slice(offset, Math.min(offset + 16, end));
		const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
		const ascii = Array.from(chunk).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
		lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(48)}  |${ascii}|`);
	}
	return lines.join('\n');
}
