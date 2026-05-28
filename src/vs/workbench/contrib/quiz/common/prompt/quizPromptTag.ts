/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region QuizPromptTag (aligned with Copilot's Tag from tag.tsx)

/**
 * Pure TypeScript equivalent of Copilot's `Tag` prompt element (tag.tsx).
 *
 * Copilot uses `@vscode/prompt-tsx` with JSX to render structured XML-like
 * tags in prompts. Since Quiz is a VS Code Core contribution and cannot use
 * TSX/prompt-tsx, this module provides the same functionality as plain
 * string-building functions.
 *
 * Usage:
 *   const text = quizTag('instructions', 'You are a coding assistant.');
 *   // => "<instructions>\nYou are a coding assistant.\n</instructions>\n"
 *
 *   const text = quizTag('example', 'Hello', { lang: 'ts' });
 *   // => "<example lang=\"ts\">\nHello\n</example>\n"
 *
 *   const text = quizTag('br', undefined);
 *   // => "<br />\n"
 */

const VALID_TAG_NAME = /^[a-zA-Z_][\w\.\-]*$/;

/**
 * Render a prompt tag with optional attributes and children.
 *
 * @param name The tag name (must match /^[a-zA-Z_][\w\.\-]*$/)
 * @param children The inner content. Pass `undefined` or `''` for a self-closing tag.
 * @param attrs Optional key-value attributes. Falsy values are omitted.
 * @returns The rendered tag string, or empty string if name is invalid
 */
export function quizTag(name: string, children?: string, attrs?: Record<string, string | number | boolean | undefined>): string {
	if (!VALID_TAG_NAME.test(name)) {
		throw new Error(`Invalid tag name: ${name}`);
	}

	let attrStr = '';
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			if (value !== undefined) {
				attrStr += ` ${key}=${JSON.stringify(value)}`;
			}
		}
	}

	// Self-closing tag: no children
	if (!children || children.length === 0) {
		if (!attrStr) {
			return '';
		}
		return `<${name}${attrStr} />\n`;
	}

	// Full tag with children
	return `<${name}${attrStr}>\n${children}\n</${name}>\n`;
}

/**
 * Render a self-closing tag (e.g., `<br />`).
 */
export function quizSelfClosingTag(name: string, attrs?: Record<string, string | number | boolean | undefined>): string {
	if (!VALID_TAG_NAME.test(name)) {
		throw new Error(`Invalid tag name: ${name}`);
	}

	let attrStr = '';
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			if (value !== undefined) {
				attrStr += ` ${key}=${JSON.stringify(value)}`;
			}
		}
	}

	return `<${name}${attrStr} />\n`;
}

/**
 * Join multiple prompt parts, filtering out empty/falsy ones.
 * Equivalent to Copilot's TSX fragment `<>...</>` composition.
 */
export function quizJoin(...parts: (string | undefined | false)[]): string {
	return parts.filter(Boolean).join('\n');
}

/**
 * Convenience: wrap content with a line break separator.
 * Equivalent to Copilot's `<br />` between prompt elements.
 */
export function quizLine(content: string): string {
	return content.endsWith('\n') ? content : content + '\n';
}

// #endregion
