/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// All built-in Quiz tools. Importing this module triggers self-registration
// via QuizBuiltinToolRegistry.register() in each tool file.
// Aligned with Copilot's tools/node/allTools.ts pattern.

// Core file tools
import './quizReadFileTool.js';
import './quizFileSearchTools.js';
import './quizEditTools.js';

// Workspace/diagnostic tools
import './quizWorkspaceTools.js';

// Terminal tools
import './quizTerminalTools.js';

// VS Code interaction tools
import './quizVscodeTools.js';

// Subagent and search tools
import './quizSubagentTools.js';

// Notebook tools
import './quizNotebookTools.js';

// Session store tools
import './quizSessionStoreTools.js';
