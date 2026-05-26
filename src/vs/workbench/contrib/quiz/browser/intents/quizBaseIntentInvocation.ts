/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
	IQuizBuildPromptProgress,
	IQuizBuildPromptResult,
	IQuizChatResult,
	IQuizChatResponse,
	IQuizChatVariablesCollection,
	IQuizDocumentContext,
	IQuizErrorDetails,
	IQuizIntent,
	IQuizIntentEndpoint,
	IQuizIntentInvocation,
	IQuizIntentLinkificationOptions,
	IQuizPromptMessage,
	IQuizResponsePart,
	IQuizResponseProcessorContext,
	IQuizResponseStream,
	QuizStreamingMarkdownReplyInterpreter,
	IQuizToolInfo,
	QuizEditStrategy,
	QuizPromptMessageRole,
} from '../../common/intents/quizIntents.js';
import { QuizPseudoStopStartResponseProcessor } from './quizResponseProcessors.js';

// #region Base IntentInvocation (aligned with Copilot's RendererIntentInvocation)

export abstract class QuizRendererIntentInvocationImpl implements IQuizIntentInvocation {

	readonly editStrategy: QuizEditStrategy = QuizEditStrategy.Auto;

	constructor(
		readonly intent: IQuizIntent,
		readonly location: ChatAgentLocation,
		readonly endpoint: IQuizIntentEndpoint,
		readonly documentContext?: IQuizDocumentContext,
	) { }

	abstract createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[];

	async buildPrompt(
		context: IQuizBuildPromptContext,
		progress: IQuizBuildPromptProgress,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult> {
		const messages = this.createPromptElements(context);
		return { messages, tokenCount: 0 };
	}

	getAvailableTools?(): IQuizToolInfo[] | Promise<IQuizToolInfo[]> | undefined;

	confirmationHandler?(
		acceptedConfirmationData: unknown[] | undefined,
		rejectedConfirmationData: unknown[] | undefined,
		progress: IQuizResponseStream,
	): Promise<void>;

	readonly linkification: IQuizIntentLinkificationOptions = { disable: false };
	readonly codeblocksRepresentEdits?: boolean;
	modifyErrorDetails?(errorDetails: IQuizErrorDetails, response: IQuizChatResponse): IQuizErrorDetails;
	getAdditionalVariables?(context: IQuizBuildPromptContext): IQuizChatVariablesCollection | undefined;
}

// #endregion

// #region Generic Panel IntentInvocation (aligned with Copilot's GenericPanelIntentInvocation)

export class QuizGenericPanelIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = false;
	override readonly linkification: IQuizIntentLinkificationOptions = { disable: false };

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		@ILogService _logService: ILogService,
	) {
		super(intent, location, endpoint);
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		this._appendHistory(messages, context);
		messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		return messages;
	}

	processResponse?(
		_context: IQuizResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		_token: CancellationToken,
	): Promise<IQuizChatResult | void> {
		const interpreter = new QuizStreamingMarkdownReplyInterpreter();
		return interpreter.processResponse(_context, inputStream, outputStream, _token);
	}

	protected _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Answer the user\'s question helpfully and accurately.',
		].join('\n\n');
	}

	protected _appendHistory(messages: IQuizPromptMessage[], context: IQuizBuildPromptContext): void {
		for (const turn of context.history) {
			messages.push({ role: QuizPromptMessageRole.User, content: turn.request.message });
			if (turn.response) {
				messages.push({
					role: QuizPromptMessageRole.Assistant,
					content: turn.response.message.type === 'model' ? turn.response.message.message : turn.response.message.message,
				});
			}
		}
	}
}

// #endregion

// #region Generic Inline IntentInvocation (aligned with Copilot's GenericInlineIntentInvocation)

export class QuizGenericInlineIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = true;
	override readonly editStrategy = QuizEditStrategy.ForceInsertion;
	override readonly linkification: IQuizIntentLinkificationOptions = { disable: true };

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		documentContext: IQuizDocumentContext | undefined,
		@ILogService _logService: ILogService,
	) {
		super(intent, location, endpoint, documentContext);
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		if (this.documentContext) {
			messages.push({
				role: QuizPromptMessageRole.User,
				content: `The active document is ${this.documentContext.documentUri} (${this.documentContext.languageId ?? 'unknown'}).\nSelected code:\n\`\`\`\n${context.query}\n\`\`\``,
			});
		} else {
			messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		}
		return messages;
	}

	processResponse?(
		_context: IQuizResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		_token: CancellationToken,
	): Promise<IQuizChatResult | void> {
		const processor = new QuizPseudoStopStartResponseProcessor();
		return processor.processResponse(_context, inputStream, outputStream, _token);
	}

	protected _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'You are in inline edit mode. Respond with code that should replace the selected code.',
			'Do not include explanations, only the replacement code.',
		].join('\n\n');
	}
}

// #endregion
