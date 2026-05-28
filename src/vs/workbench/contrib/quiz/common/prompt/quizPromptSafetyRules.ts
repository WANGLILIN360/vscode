/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region QuizSafetyRules (aligned with Copilot's SafetyRules from safetyRules.tsx)

/**
 * Pure TypeScript equivalent of Copilot's `SafetyRules` prompt elements.
 *
 * Copilot uses `@vscode/prompt-tsx` with JSX to render safety rules in
 * system prompts. Since Quiz is a VS Code Core contribution and cannot use
 * TSX/prompt-tsx, this module provides the same content as plain string
 * functions.
 *
 * Three variants are provided, matching Copilot's three classes:
 * - `quizSafetyRules()` → `SafetyRules` (standard, all models)
 * - `quizGpt5SafetyRules()` → `Gpt5SafetyRule` (GPT-5+ models, shorter)
 * - `quizLegacySafetyRules()` → `LegacySafetyRules` (legacy models)
 */

/**
 * Standard safety rules for all models.
 * Aligned with Copilot's `SafetyRules.render()`.
 */
export function quizSafetyRules(): string {
	return [
		'Follow Microsoft content policies.',
		'Avoid content that violates copyrights.',
		'If you are asked to generate content that is harmful, hateful, racist, sexist, lewd, or violent, only respond with "Sorry, I can\'t assist with that."',
		'Keep your answers short and impersonal.',
	].join('\n');
}

/**
 * Safety rules for GPT-5+ models (shorter, omits "Keep your answers short and impersonal").
 * Aligned with Copilot's `Gpt5SafetyRule.render()`.
 */
export function quizGpt5SafetyRules(): string {
	return [
		'Follow Microsoft content policies.',
		'Avoid content that violates copyrights.',
		'If you are asked to generate content that is harmful, hateful, racist, sexist, lewd, or violent, only respond with "Sorry, I can\'t assist with that."',
	].join('\n');
}

/**
 * Legacy safety rules (includes "completely irrelevant to software engineering" qualifier).
 * Aligned with Copilot's `LegacySafetyRules.render()`.
 */
export function quizLegacySafetyRules(): string {
	return [
		'Follow Microsoft content policies.',
		'Avoid content that violates copyrights.',
		'If you are asked to generate content that is harmful, hateful, racist, sexist, lewd, violent, or completely irrelevant to software engineering, only respond with "Sorry, I can\'t assist with that."',
		'Keep your answers short and impersonal.',
	].join('\n');
}

/**
 * Select the appropriate safety rules based on the model family.
 * This mirrors Copilot's conditional rendering logic where different
 * model families get different safety rule variants.
 */
export function quizSafetyRulesForModel(modelFamily: string): string {
	if (modelFamily.startsWith('gpt-5')) {
		return quizGpt5SafetyRules();
	}
	// Default to standard safety rules
	return quizSafetyRules();
}

// #endregion
