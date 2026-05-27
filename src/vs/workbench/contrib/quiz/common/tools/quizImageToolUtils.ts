/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/node/imageToolUtils.ts

import { URI } from '../../../../../base/common/uri.js';

/** Maximum image file size in bytes (20 MB) */
export const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Image MIME types supported by the chat image data part.
 * Aligned with Copilot's ChatImageMimeType.
 */
export enum QuizChatImageMimeType {
	PNG = 'image/png',
	JPEG = 'image/jpeg',
	GIF = 'image/gif',
	WEBP = 'image/webp',
}

const imageExtensionToMimeType: Record<string, QuizChatImageMimeType> = {
	'.png': QuizChatImageMimeType.PNG,
	'.jpg': QuizChatImageMimeType.JPEG,
	'.jpeg': QuizChatImageMimeType.JPEG,
	'.gif': QuizChatImageMimeType.GIF,
	'.webp': QuizChatImageMimeType.WEBP,
};

export function getImageMimeType(uri: URI): QuizChatImageMimeType | undefined {
	const path = uri.path.toLowerCase();
	for (const [ext, mime] of Object.entries(imageExtensionToMimeType)) {
		if (path.endsWith(ext)) {
			return mime;
		}
	}

	return undefined;
}
