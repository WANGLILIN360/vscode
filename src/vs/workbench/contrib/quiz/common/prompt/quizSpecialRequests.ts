/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { IChatAgentRequest } from '../../../chat/common/participants/chatAgents.js';

// #region IQuizToolCallIterationIncrease (aligned with Copilot's IToolCallIterationIncrease)

/**
 * Confirmation data type for requesting an increase in the tool call iteration limit.
 * When the agent loop hits the max rounds, it can ask the user to approve more rounds.
 */
export interface IQuizToolCallIterationIncrease {
	quizRequestedRoundLimit: number;
}

const _isToolCallIterationIncrease = (c: unknown): c is IQuizToolCallIterationIncrease =>
	!!(c && typeof (c as IQuizToolCallIterationIncrease).quizRequestedRoundLimit === 'number');

export function getQuizRequestedToolCallIterationLimit(request: IChatAgentRequest): number | undefined {
	return request.acceptedConfirmationData?.find(_isToolCallIterationIncrease)?.quizRequestedRoundLimit;
}

export function getQuizRejectedToolCallIterationLimit(request: IChatAgentRequest): number | undefined {
	return request.rejectedConfirmationData?.find(_isToolCallIterationIncrease)?.quizRequestedRoundLimit;
}

export function isQuizToolCallLimitCancellation(request: IChatAgentRequest): boolean {
	return !!getQuizRejectedToolCallIterationLimit(request);
}

export function isQuizToolCallLimitAcceptance(request: IChatAgentRequest): boolean {
	return !!getQuizRequestedToolCallIterationLimit(request) && !isQuizToolCallLimitCancellation(request);
}

// todo@connor4312 improve with the choices API
export const quizCancelText = () => localize('quiz.toolCallLimit.cancel', 'Pause');

// #endregion

// #region IQuizContinueOnErrorConfirmation (aligned with Copilot's IContinueOnErrorConfirmation)

/**
 * Confirmation data type for continuing the agent loop after an error occurs.
 */
export interface IQuizContinueOnErrorConfirmation {
	quizContinueOnError: true;
}

function _isContinueOnErrorConfirmation(c: unknown): c is IQuizContinueOnErrorConfirmation {
	return !!(c && (c as IQuizContinueOnErrorConfirmation).quizContinueOnError === true);
}

export function isQuizContinueOnError(request: IChatAgentRequest): boolean {
	return !!(request.acceptedConfirmationData?.some(_isContinueOnErrorConfirmation));
}

// #endregion

// #region IQuizSwitchToAutoOnRateLimitConfirmation (aligned with Copilot's ISwitchToAutoOnRateLimitConfirmation)

/**
 * Confirmation data type for switching to auto mode when a rate limit is hit.
 */
export interface IQuizSwitchToAutoOnRateLimitConfirmation {
	quizSwitchToAutoOnRateLimit: true;
	alwaysSwitchToAuto: boolean;
}

function _isSwitchToAutoOnRateLimitConfirmation(c: unknown): c is IQuizSwitchToAutoOnRateLimitConfirmation {
	return !!(c && (c as IQuizSwitchToAutoOnRateLimitConfirmation).quizSwitchToAutoOnRateLimit === true);
}

export function getQuizSwitchToAutoOnRateLimitConfirmation(request: IChatAgentRequest): IQuizSwitchToAutoOnRateLimitConfirmation | undefined {
	return request.acceptedConfirmationData?.find(_isSwitchToAutoOnRateLimitConfirmation);
}

export function isQuizSwitchToAutoOnRateLimit(request: IChatAgentRequest): boolean {
	return !!(request.acceptedConfirmationData?.some(_isSwitchToAutoOnRateLimitConfirmation));
}

// #endregion
