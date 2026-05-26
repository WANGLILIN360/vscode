/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/common/fileTreeParser.ts

/**
 * A node in a file tree, representing a file or directory.
 */
export interface IQuizFileTreePart {
	readonly name: string;
	readonly children?: IQuizFileTreePart[];
	readonly isDirectory: boolean;
}

/**
 * Parse a markdown-style file tree string into a structured tree.
 * Input format:
 * ```
 * src/
 *   main.ts
 *   utils/
 *     helper.ts
 * test/
 *   main.test.ts
 * ```
 */
export function quizParseFileTree(text: string): IQuizFileTreePart | undefined {
	const lines = text.split(/\r?\n/);
	if (lines.length === 0) {
		return undefined;
	}

	// Filter out empty lines
	const nonEmptyLines = lines.filter(l => l.trim().length > 0);
	if (nonEmptyLines.length === 0) {
		return undefined;
	}

	return parseTreeLines(nonEmptyLines);
}

function parseTreeLines(lines: string[]): IQuizFileTreePart {
	const root: IQuizFileTreePart = { name: '', children: [], isDirectory: true };

	// Stack of (node, indentLevel)
	const stack: { node: IQuizFileTreePart; indentLevel: number }[] = [{ node: root, indentLevel: -1 }];

	for (const line of lines) {
		const indentLevel = getTreeDepth(line);
		const name = line.trim();

		if (name.length === 0) {
			continue;
		}

		// Guard against unsafe node names
		if (isUnsafeNodeName(name)) {
			continue;
		}

		// Filter out common build/image/lock files
		if (isIgnoredFileName(name)) {
			continue;
		}

		const isDirectory = name.endsWith('/') || name.endsWith('\\');
		const cleanName = isDirectory ? name.slice(0, -1) : name;
		const child: IQuizFileTreePart = { name: cleanName, isDirectory, children: isDirectory ? [] : undefined };

		// Pop stack until we find the parent
		while (stack.length > 1 && stack[stack.length - 1].indentLevel >= indentLevel) {
			stack.pop();
		}

		const parent = stack[stack.length - 1].node;
		if (parent.children) {
			parent.children.push(child);
		}

		if (isDirectory) {
			stack.push({ node: child, indentLevel });
		}
	}

	return root;
}

function getTreeDepth(line: string): number {
	let depth = 0;
	for (let i = 0; i < line.length; i++) {
		const ch = line.charAt(i);
		if (ch === ' ' || ch === '\t') {
			depth++;
		} else {
			break;
		}
	}
	return depth;
}

function isUnsafeNodeName(name: string): boolean {
	// Block path traversal attempts
	if (name.includes('..')) {
		return true;
	}
	// Block absolute paths
	if (name.startsWith('/') || name.startsWith('\\')) {
		return true;
	}
	return false;
}

const IGNORED_FILE_PATTERNS = [
	'node_modules',
	'.git',
	'.DS_Store',
	'package-lock.json',
	'yarn.lock',
	'pnpm-lock.yaml',
	'.env',
	'dist',
	'build',
	'out',
	'__pycache__',
	'.pytest_cache',
	'.venv',
	'venv',
	'target',
	'bin',
	'obj',
	'.idea',
	'.vs',
];

function isIgnoredFileName(name: string): boolean {
	const cleanName = name.replace(/[\/\\]$/, '');
	return IGNORED_FILE_PATTERNS.includes(cleanName);
}

/**
 * List all file paths in a parsed file tree.
 */
export function quizListFilesInTree(tree: IQuizFileTreePart): string[] {
	const files: string[] = [];

	function walk(node: IQuizFileTreePart, prefix: string): void {
		const path = prefix ? `${prefix}/${node.name}` : node.name;
		if (node.isDirectory) {
			if (node.children) {
				for (const child of node.children) {
					walk(child, path);
				}
			}
		} else {
			files.push(path);
		}
	}

	if (tree.children) {
		for (const child of tree.children) {
			walk(child, '');
		}
	}

	return files;
}
