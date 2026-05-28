/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/telemetry/common/nullExperimentationService.ts

import { Emitter, Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizTreatmentsChangeEvent (aligned with Copilot's TreatmentsChangeEvent)

/**
 * An event describing the change in A/B experiment treatments.
 * Aligned with Copilot's TreatmentsChangeEvent.
 */
export interface IQuizTreatmentsChangeEvent {
	/** List of changed treatment variables */
	affectedTreatmentVariables: string[];
}

// #endregion

// #region IQuizExperimentationService (aligned with Copilot's IExperimentationService)

export const IQuizExperimentationService = createDecorator<IQuizExperimentationService>('quizExperimentationService');

/**
 * Experimentation service for A/B testing.
 * Aligned with Copilot's IExperimentationService (platform/telemetry/common/nullExperimentationService.ts).
 *
 * Quiz bridges VS Code's IConfigurationService for experiment/feature flags
 * instead of Copilot's separate TAS (Treatment Assignment Service) pipeline.
 * This interface provides the same query API so that code ported from Copilot
 * can check treatment variables without modification.
 *
 * Currently Quiz only provides the Null implementation. A real implementation
 * would bridge VS Code's experiments infrastructure or a custom A/B service.
 */
export interface IQuizExperimentationService {
	readonly _serviceBrand: undefined;

	/**
	 * Emitted when treatment values change (e.g., user account change, refresh).
	 * Aligned with Copilot's IExperimentationService.onDidTreatmentsChange.
	 */
	readonly onDidTreatmentsChange: Event<IQuizTreatmentsChangeEvent>;

	/**
	 * Promise that resolves when the experimentation service has completed
	 * its first request to the Treatment Assignment Service.
	 * Aligned with Copilot's IExperimentationService.hasTreatments().
	 */
	hasTreatments(): Promise<void>;

	/**
	 * Returns the value of a treatment variable, or undefined if not found.
	 * Aligned with Copilot's IExperimentationService.getTreatmentVariable().
	 *
	 * @param name Name of the treatment variable
	 */
	getTreatmentVariable<T extends boolean | number | string>(name: string): T | undefined;

	/**
	 * Sets filters for completions experiments.
	 * Aligned with Copilot's IExperimentationService.setCompletionsFilters().
	 * @deprecated Will be removed after completions migration.
	 */
	setCompletionsFilters(filters: Map<string, string>): void;
}

// #endregion

// #region NullQuizExperimentationService (aligned with Copilot's NullExperimentationService)

/**
 * Null implementation of IQuizExperimentationService.
 * Aligned with Copilot's NullExperimentationService.
 * All treatment variables return undefined (no experiments active).
 */
export class NullQuizExperimentationService implements IQuizExperimentationService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidTreatmentsChange = new Emitter<IQuizTreatmentsChangeEvent>();
	readonly onDidTreatmentsChange: Event<IQuizTreatmentsChangeEvent> = this._onDidTreatmentsChange.event;

	static readonly Instance = new NullQuizExperimentationService();

	async hasTreatments(): Promise<void> { return Promise.resolve(); }

	getTreatmentVariable<T extends boolean | number | string>(_name: string): T | undefined {
		return undefined;
	}

	setCompletionsFilters(_filters: Map<string, string>): void { }
}

// #endregion
