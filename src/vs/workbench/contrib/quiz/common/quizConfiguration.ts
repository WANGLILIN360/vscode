/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Configuration keys for Quiz

export const QuizConfiguration = {
	Enabled: 'quiz.enabled',
	AgentMaxRequests: 'chat.agent.maxRequests',
	DefaultModel: 'quiz.defaultModel',
	EndpointUrl: 'quiz.endpointUrl',
} as const;
