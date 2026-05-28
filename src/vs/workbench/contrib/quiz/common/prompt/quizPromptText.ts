/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region QuizPromptText (aligned with Copilot's TextChunk / Text from @vscode/prompt-tsx)

/**
 * Pure TypeScript equivalent of Copilot's `TextChunk` / `Text` prompt component
 * from `@vscode/prompt-tsx`.
 *
 * In Copilot's TSX system, `<TextChunk>` wraps a string with priority and
 * flexibility metadata that the prompt-tsx runtime uses for token budget
 * management — higher-priority chunks are kept when the budget is tight,
 * while lower-priority chunks can be pruned.
 *
 * Since Quiz is a VS Code Core contribution and cannot use prompt-tsx,
 * this module provides the same concept as a plain data structure with
 * helper functions for composition and budget-aware rendering.
 */

/**
 * A prompt text chunk with optional priority and flexibility metadata.
 * Aligned with prompt-tsx's TextChunk props.
 */
export interface IQuizPromptTextChunk {
	/** The text content */
	readonly text: string;
	/**
	 * Priority for token budget pruning. Higher values = more important.
	 * Default is 0. Chunks with priority < 0 are pruned first.
	 * Aligned with prompt-tsx's `priority` prop.
	 */
	readonly priority?: number;
	/**
	 * Flex growth — how much this chunk can shrink when budget is tight.
	 * 0 = must keep entirely, >0 = can be partially pruned.
	 * Aligned with prompt-tsx's `flexGrow` prop.
	 */
	readonly flexGrow?: number;
}

/**
 * Create a prompt text chunk.
 */
export function quizText(text: string, options?: { priority?: number; flexGrow?: number }): IQuizPromptTextChunk {
	return {
		text,
		priority: options?.priority,
		flexGrow: options?.flexGrow,
	};
}

/**
 * A prompt section that groups multiple text chunks under a tag name
 * with priority for the entire section.
 *
 * This is the pure-TS equivalent of Copilot's pattern:
 *   <InstructionMessage>
 *     <Tag name='instructions'>...</Tag>
 *     <Tag name='toolUseInstructions'>...</Tag>
 *   </InstructionMessage>
 */
export interface IQuizPromptSection {
	/** Section tag name (e.g., 'instructions', 'toolUseInstructions') */
	readonly tagName: string;
	/** Chunks in this section */
	readonly chunks: readonly IQuizPromptTextChunk[];
	/** Section-level priority (overrides chunk priorities for pruning) */
	readonly priority?: number;
}

/**
 * Create a prompt section with a tag name and chunks.
 */
export function quizSection(tagName: string, chunks: readonly IQuizPromptTextChunk[], options?: { priority?: number }): IQuizPromptSection {
	return {
		tagName,
		chunks,
		priority: options?.priority,
	};
}

/**
 * Render a prompt section to a string, wrapping content in XML-like tags.
 * Uses quizTag formatting: `<tagName>\ncontent\n</tagName>\n`
 */
export function quizRenderSection(section: IQuizPromptSection): string {
	const content = section.chunks
		.map(chunk => chunk.text)
		.filter(text => text.length > 0)
		.join('\n');

	if (!content) {
		return '';
	}

	return `<${section.tagName}>\n${content}\n</${section.tagName}>\n`;
}

/**
 * Render multiple prompt sections to a single string,
 * sorted by priority (highest first) for budget-aware rendering.
 */
export function quizRenderSections(sections: readonly IQuizPromptSection[], maxChars?: number): string {
	// Sort by priority descending (highest priority first)
	const sorted = [...sections].sort((a, b) => {
		const pa = a.priority ?? 0;
		const pb = b.priority ?? 0;
		return pb - pa;
	});

	const rendered: string[] = [];
	let totalChars = 0;

	for (const section of sorted) {
		const text = quizRenderSection(section);
		if (!text) {
			continue;
		}

		if (maxChars !== undefined && totalChars + text.length > maxChars) {
			// Skip low-priority sections that exceed budget
			const priority = section.priority ?? 0;
			if (priority < 0) {
				continue;
			}
			// For non-negative priority, include even if over budget
		}

		rendered.push(text);
		totalChars += text.length;
	}

	return rendered.join('');
}

/**
 * Convenience: create a simple text chunk from a string.
 * Equivalent to Copilot's `<TextChunk>{text}</TextChunk>`.
 */
export function quizTextChunk(text: string): IQuizPromptTextChunk {
	return { text };
}

/**
 * Convenience: create a text chunk with "keep with next" semantics.
 * Equivalent to Copilot's `<KeepWith>` wrapper — ensures this text
 * is not split from the next chunk during pruning.
 *
 * In the pure-TS implementation, this is expressed by giving the
 * chunk a high priority so it won't be pruned.
 */
export function quizKeepWith(text: string): IQuizPromptTextChunk {
	return { text, priority: 100 };
}

// #endregion
