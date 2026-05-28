/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region QuizCapturingToken (aligned with Copilot's CapturingToken)

/**
 * A token that can be used to capture and group related requests together.
 * Aligned with Copilot's CapturingToken (platform/requestLogger/common/capturingToken.ts).
 *
 * This is the **request correlation** mechanism for Quiz's QAPI path.
 * It enables:
 * - Grouping related network requests (e.g., all requests in an agent turn)
 * - Linking subagent requests to their parent agent request
 * - Tracking chat session IDs for trajectory/debug log correlation
 * - Providing labels and icons for request tree visualization
 *
 * ### Usage (aligned with Copilot's CapturingToken flow):
 *
 * ```ts
 * // Main agent turn
 * const token = new QuizCapturingToken('Agent Turn', undefined, chatSessionId);
 *
 * // Subagent invocation
 * const subToken = new QuizCapturingToken(
 *   'Search Subagent',
 *   undefined,
 *   subAgentInvocationId,
 *   'search',
 *   chatSessionId,
 *   parentChatSessionId,
 *   'search'
 * );
 * ```
 *
 * The token is passed through the request pipeline and attached to
 * telemetry events, debug logs, and network request metadata.
 */
export class QuizCapturingToken {

	constructor(
		/**
		 * A label to display for the parent tree element.
		 * Used in debug log panels and request tree visualization.
		 */
		public readonly label: string,

		/**
		 * An optional icon to display alongside the label.
		 * Codicon name (e.g., 'search', 'terminal', 'git-branch').
		 */
		public readonly icon: string | undefined,

		/**
		 * Optional pre-assigned subAgentInvocationId as session id for trajectory tracking.
		 * When set, the trajectory will use this ID instead of generating a new one,
		 * enabling explicit linking between parent tool calls and subagent trajectories.
		 * Aligned with Copilot's CapturingToken.subAgentInvocationId.
		 */
		public readonly subAgentInvocationId?: string,

		/**
		 * Optional name of the subagent being invoked.
		 * Used alongside subAgentInvocationId to identify the subagent in trajectory tracking.
		 * Aligned with Copilot's CapturingToken.subAgentName.
		 */
		public readonly subAgentName?: string,

		/**
		 * Optional VS Code chat session ID for trajectory tracking.
		 * When set, this ID is used directly as the trajectory session ID for the main chat,
		 * providing a 1:1 mapping between chat sessions and trajectories.
		 * Aligned with Copilot's CapturingToken.chatSessionId.
		 */
		public readonly chatSessionId?: string,

		/**
		 * Optional parent chat session ID for debug log grouping.
		 * When set, logs from this invocation are written as a child of
		 * the parent session's directory instead of creating a top-level log file.
		 * Aligned with Copilot's CapturingToken.parentChatSessionId.
		 */
		public readonly parentChatSessionId?: string,

		/**
		 * Optional label for debug log child sessions (e.g., 'title', 'categorization').
		 * Used to name the child log file within the parent session's directory.
		 * Aligned with Copilot's CapturingToken.debugLogLabel.
		 */
		public readonly debugLogLabel?: string,
	) { }
}

// #endregion
