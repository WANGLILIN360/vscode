# quiz 完整文件规范

## 根目录

```
src/vs/workbench/contrib/quiz/
```

---

## browser/ -- UI 层

### browser/quiz.contribution.ts
**类型**: 注册文件
**说明**: quiz 模块的总入口。在 `workbench.common.main.ts` 中被 import。负责注册：
- ViewPane (quiz Chat 面板)
- Commands 和 Actions
- Keybindings
- Settings (configuration)
- Context Keys
- IQuizService (通过 instantiation service)
- quiz 作为 Chat Participant
- quiz Tools
**依赖**: `IChatAgentService`, `IViewsRegistry`, `IInstantiationService`, `ILanguageModelToolsService`
**对照**: 类比 `contrib/chat/browser/chat.contribution.ts` + Copilot 的 `package.json` contributes

### browser/quizAgentView.ts
**类型**: ViewPane 子类
**说明**: quiz Chat 面板的主 ViewPane。承载 ChatWidget。
**核心代码**: 继承 `ChatViewPane`，传入 quiz-specific 的 ChatWidget 选项
**依赖**: `ChatViewPane` (from `contrib/chat/browser/chatViewPane`)
**对照**: Core 已有 `chatViewPane.ts`，quiz 扩展或配置使用

### browser/quizWidget.ts
**类型**: ChatWidget 配置
**说明**: quiz 使用 Core 的 ChatWidget，此文件负责：
- 配置 quiz 品牌选项（welcome message, placeholder text）
- 绑定 quiz agent 到 widget
- 设置 quiz 专用的 mode 选项
**核心代码**: 复用 `ChatWidget`，传入 quiz 配置
**依赖**: `ChatWidget` (from `contrib/chat/browser/widget/chatWidget.ts`)
**对照**: Core 已有 `widget/chatWidget.ts`，quiz 仅需配置

### browser/quizInputPart.ts
**类型**: 配置/扩展
**说明**: quiz 使用 Core 的 ChatInputPart，此文件负责：
- 配置输入框 placeholder ("Ask quiz...")
- 添加 quiz 专用工具按钮
- 配置附件类型
**依赖**: `ChatInputPart` (from `contrib/chat/browser/chatInputPart.ts`)
**对照**: Core 已有 `chatInputPart.ts`

### browser/quizEditingWidget.ts
**类型**: 适配器
**说明**: 复用 Core 的 chatEditing 系统。此文件负责：
- 将 quiz agent 的编辑结果接入 Core 的 editing session
- 配置 Keep/Undo 按钮的 quiz 品牌文本
**依赖**: `IChatEditingSession` (from `contrib/chat/browser/chatEditing/`)
**对照**: Core 已有 `browser/chatEditing/`，quiz 复用

### browser/quizStatusBar.ts
**类型**: StatusBar 贡献
**说明**: 状态栏中的 quiz 图标和状态显示
**核心功能**: 
- 显示 quiz 连接状态
- 点击打开 quiz Chat 面板
- 显示当前模型信息
**依赖**: `IStatusbarService`
**对照**: Copilot 有状态栏图标，Core 有 `browser/chatStatus/`

### browser/actions/quizActions.ts
**类型**: Actions 注册
**说明**: 所有 quiz 相关的 Actions：
- `quiz.openChat` - 打开 quiz Chat
- `quiz.openInline` - 打开 Inline quiz
- `quiz.openQuick` - 打开 Quick quiz
- `quiz.acceptEdit` - 接受编辑
- `quiz.rejectEdit` - 拒绝编辑
- `quiz.clearChat` - 清除对话
- `quiz.copyCode` - 复制代码块
**依赖**: `Action2`, `IViewsService`, `IChatService`
**对照**: 类比 `contrib/chat/browser/actions/`

### browser/media/quiz.css
**类型**: CSS 样式
**说明**: quiz 品牌样式：
- quiz 主题色变量
- 欢迎页面样式
- 消息气泡样式
- 工具调用卡片样式
**对照**: Copilot 有品牌 CSS

### browser/telemetry/quizTelemetry.ts
**类型**: Telemetry 发送器
**说明**: quiz 专用遥测事件发送
**对照**: Copilot `platform/telemetry/`

---

## common/ -- 业务逻辑层

### common/quizService.ts
**类型**: 接口定义
**说明**: quiz 主服务接口。定义 quiz 的核心能力：
```typescript
export interface IQuizService {
  readonly _serviceBrand: undefined;
  readonly onQuizReady: Event<void>;
  
  // 发送请求并获取流式响应
  sendRequest(message: string, sessionId?: string): Promise<IChatResponseModel>;
  
  // Session 管理
  getSession(sessionId: string): IQuizSession | undefined;
  createSession(): Promise<IQuizSession>;
  clearSession(sessionId: string): void;
  
  // Agent 控制
  setMode(mode: ChatModeKind): void;
  getMode(): ChatModeKind;
  
  // 工具
  getAvailableTools(): IChatTool[];
  
  // Prompt
  buildPrompt(request: IChatAgentRequest, intent: QuizIntent): Promise<PromptElement>;
  
  // 状态
  isReady(): boolean;
}
```
**依赖**: `IChatService`, `IChatAgentService`, `ILanguageModelToolsService`
**对照**: Copilot 的核心 orchestration 逻辑分散在 `extension/chat/` 和 `extension/conversation/`

### common/quizServiceImpl.ts
**类型**: 服务实现
**说明**: IQuizService 的实现。核心编排逻辑：
1. 接收用户请求
2. 调用 IntentService 分类意图
3. 调用 PromptService 构建 Prompt
4. 调用 LanguageModel 发送请求
5. 处理流式响应
6. 管理工具调用循环
7. 管理会话状态
**核心方法**: `handleRequest()`, `handleToolCalls()`, `streamResponse()`
**依赖**: `IQuizService`, `IIntentService`, `IPromptService`, `ILanguageModelProvider`
**对照**: Copilot `extension/chat/chatSession.ts` + `extension/conversation/`

### common/quizAgent.ts
**类型**: Agent 注册器
**说明**: 将 quiz 注册为 Core Chat 系统的 Participant/Agent
```typescript
export class QuizAgent {
  constructor(
    @IChatAgentService private readonly agentService: IChatAgentService,
    @IQuizService private readonly quizService: IQuizService
  ) {
    this.register();
  }
  
  private register(): void {
    this.agentService.registerAgent({
      id: 'quiz',
      name: 'quiz',
      isDefault: true,
      locations: [ChatAgentLocation.Panel, ChatAgentLocation.Editor, ChatAgentLocation.Notebook],
      metadata: {
        description: 'quiz AI coding assistant',
        supportIssueReporting: true,
      }
    }, {
      invoke: (request, context, response, token) => 
        this.quizService.sendRequest(request.message, request.sessionId)
    });
  }
}
```
**依赖**: `IChatAgentService`, `IQuizService`, `ChatAgentLocation`
**对照**: Copilot 在 `extension/` 中注册 participant

### common/quizLanguageModel.ts
**类型**: Language Model Provider
**说明**: quiz 的 LLM Provider 实现。管理：
- 与 LLM API 的通信 (OpenAI, Anthropic, Gemini 等)
- API Key / Token 管理
- 请求/响应格式化
- 流式响应处理
- 模型选择和路由
- 重试和错误处理
- Token 用量追踪
```typescript
export interface IQuizLanguageModelProvider {
  sendRequest(messages: ChatMessage[], options: {}, token: CancellationToken): Promise<IQuizLLMResponse>;
  countTokens(text: string): Promise<number>;
  getAvailableModels(): Promise<ILanguageModelChatMetadata[]>;
}
```
**依赖**: `ILanguageModelsService`, `IRequestService`
**对照**: Copilot `platform/endpoint/`

### common/constants.ts
**类型**: 常量定义
**说明**: 所有 quiz 常量：
```typescript
// 意图枚举
export enum QuizIntent {
  Explain = 'explain',
  Review = 'review', 
  Tests = 'tests',
  Fix = 'fix',
  New = 'new',
  Terminal = 'terminal',
  Workspace = 'workspace',
  Edit = 'edit',
  Agent = 'agent',
  Ask = 'ask',
}

// Chat 模式
export enum QuizMode {
  Ask = 'ask',
  Edit = 'edit', 
  Agent = 'agent',
}

// 工具 ID
export const QUIZ_TOOL_READ_FILE = 'quiz_readFile';
export const QUIZ_TOOL_EDIT_FILE = 'quiz_editFile';
export const QUIZ_TOOL_TERMINAL = 'quiz_terminal';
export const QUIZ_TOOL_SEARCH = 'quiz_search';
// ...

// 设置 Key
export const SETTING_QUIZ_ENABLED = 'quiz.enabled';
export const SETTING_QUIZ_MODEL = 'quiz.model';
export const SETTING_QUIZ_API_KEY = 'quiz.apiKey';
// ...

// Context Keys
export const CTX_QUIZ_ENABLED = new RawContextKey<boolean>('quizEnabled', false);
export const CTX_QUIZ_IN_PROGRESS = new RawContextKey<boolean>('quizInProgress', false);
```
**对照**: Copilot 的 intents、context keys、settings 定义

### common/auth/

#### common/auth/quizAuth.ts
**类型**: 认证管理器
**说明**: quiz 认证总控：
- 检测认证状态
- 触发登录流程
- 管理 Token 生命周期
- 支持多 Provider (GitHub, Google, API Key)
**依赖**: `IAuthenticationService`
**对照**: Copilot `platform/authentication/`

#### common/auth/githubAuth.ts
**类型**: GitHub OAuth Provider
**说明**: GitHub OAuth 认证：
- OAuth 流程
- Token 存储 (SecretStorage)
- Token 刷新
- Entitlement 检查
**依赖**: `IAuthenticationService`, `IGitHubServer` 
**对照**: Copilot `platform/authentication/` + `platform/github/`

#### common/auth/tokenManager.ts
**类型**: Token 管理
**说明**: Token 的存储、刷新、过期处理
**对照**: Copilot `platform/authentication/`

### common/model/

#### common/model/quizSession.ts
**类型**: 数据模型
**说明**: quiz Session 数据模型。扩展 Core 的 ChatModel：
```typescript
interface IQuizSession {
  readonly id: string;
  readonly chatModel: IChatModel;           // Core 的 ChatModel
  readonly mode: QuizMode;
  readonly intent: QuizIntent;
  readonly context: IQuizContext;
  readonly toolCalls: IChatToolInvocation[];
  readonly createdAt: number;
  readonly lastActivity: number;
}
```
**依赖**: `IChatModel` (from `contrib/chat/common/model/chatModel.ts`)
**对照**: Copilot `extension/chatSessions/`

### common/prompts/

#### common/prompts/quizAgentPrompt.tsx
**类型**: TSX Prompt 组件
**说明**: Agent 模式主 Prompt。包含：
- quiz 身份定义
- 工具使用规则
- 工作区上下文
- 用户查询
- 对话历史
- 当前附件
```tsx
export class QuizAgentPrompt extends PromptElement<AgentPromptProps> {
  render() {
    return (
      <>
        <SystemMessage priority={100}>
          <QuizIdentity />
          <SafetyRules />
          <ToolInstructions tools={this.props.tools} />
        </SystemMessage>
        <UserMessage priority={80}>
          <WorkspaceContext snapshot={this.props.workspace} />
        </UserMessage>
        <ConversationHistory messages={this.props.history} />
        <UserMessage priority={60}>
          <AttachedContext context={this.props.attachments} />
          <UserRequest query={this.props.query} />
        </UserMessage>
      </>
    );
  }
}
```
**依赖**: `PromptElement` (from `contrib/chat/common/prompts/promptTsx`)
**对照**: Copilot `extension/prompts/node/agent/agentPrompt.tsx`

#### common/prompts/quizPanelPrompt.tsx
**类型**: TSX Prompt 组件
**说明**: Panel Chat 模式 Prompt (非 Agent 的对话模式)
**对照**: Copilot `extension/prompts/node/panel/`

#### common/prompts/quizInlinePrompt.tsx
**类型**: TSX Prompt 组件
**说明**: Inline Chat 模式 Prompt
**对照**: Copilot `extension/prompts/node/inline/`

#### common/prompts/base/quizIdentity.tsx
**类型**: TSX Prompt 组件
**说明**: quiz AI 助手的身份定义
```tsx
export class QuizIdentity extends PromptElement {
  render() {
    return (
      <TextChunk priority={100}>
        You are quiz, an AI coding assistant integrated into the code editor.
        You help users write, understand, and improve code.
        You have expert-level knowledge across programming languages and frameworks.
        Always follow the user's coding style and preferences.
        Be concise and accurate in your responses.
      </TextChunk>
    );
  }
}
```
**对照**: Copilot `extension/prompts/node/base/`

#### common/prompts/base/toolInstructions.tsx
**类型**: TSX Prompt 组件
**说明**: 工具使用指令，告诉 LLM 如何使用工具
```tsx
export class ToolInstructions extends PromptElement<{ tools: IChatTool[] }> {
  render() {
    return (
      <TextChunk priority={95}>
        Available tools:
        {this.props.tools.map(t => `\n- ${t.name}: ${t.description}`)}
        Use tools by calling them with JSON parameters.
        Wait for tool results before proceeding.
        Prefer read_file over multiple small reads.
        Use search to find relevant code before editing.
      </TextChunk>
    );
  }
}
```
**对照**: Copilot `extension/prompts/node/base/`

#### common/prompts/base/workspaceContext.tsx
**类型**: TSX Prompt 组件
**说明**: 当前工作区上下文
```tsx
export class WorkspaceContext extends PromptElement<{ workspace: IWorkspaceSnapshot }> {
  render() {
    return (
      <TextChunk priority={80}>
        Current workspace: {this.props.workspace.name}
        Open files: {this.props.workspace.openEditors.join(', ')}
        Active file: {this.props.workspace.activeEditor}
        Language: {this.props.workspace.language}
      </TextChunk>
    );
  }
}
```
**对照**: Copilot `extension/prompts/node/base/`

#### common/prompts/base/conversationHistory.tsx
**类型**: TSX Prompt 组件
**说明**: 对话历史渲染，支持摘要
```tsx
export class ConversationHistory extends PromptElement<{ messages: IChatMessage[] }> {
  render() {
    return this.props.messages.map((m, i) => (
      <TextChunk key={i} priority={Math.max(10, 50 - i)}>
        {m.role === 'user' 
          ? <UserMessage>{m.content}</UserMessage>
          : <AssistantMessage>{m.content}</AssistantMessage>
        }
      </TextChunk>
    ));
  }
}
```
**对照**: Copilot `extension/prompts/node/agent/summarizedConversationHistory.tsx`

#### common/prompts/base/summarizer.tsx
**类型**: 摘要器
**说明**: 对话过长时的摘要逻辑
**对照**: Copilot `extension/prompts/node/agent/backgroundSummarizer.ts`

#### common/prompts/registry/promptRegistry.ts
**类型**: 注册表
**说明**: 根据模型类型路由到不同 Prompt
```typescript
export class PromptRegistry {
  private resolvers: IPromptResolver[] = [
    new AnthropicPromptResolver(),   // Claude
    new OpenAIPromptResolver(),      // GPT
    new GeminiPromptResolver(),      // Gemini
  ];
  
  resolvePrompt(endpoint: IChatEndpoint): PromptConstructor {
    for (const resolver of this.resolvers) {
      if (resolver.matches(endpoint)) {
        return resolver.getPrompt();
      }
    }
    return DefaultQuizPrompt;
  }
}
```
**对照**: Copilot `extension/prompts/node/agent/promptRegistry.ts`

#### common/prompts/registry/anthropicPrompts.tsx
**类型**: Claude 专用 Prompt
**说明**: Anthropic Claude 模型的专用 Prompt 变体
**对照**: Copilot `extension/prompts/node/agent/anthropicPrompts.tsx`

#### common/prompts/registry/openaiPrompts.tsx
**类型**: GPT 专用 Prompt
**说明**: OpenAI GPT 模型的专用 Prompt 变体
**对照**: Copilot `extension/prompts/node/agent/openai/`

#### common/prompts/registry/geminiPrompts.tsx
**类型**: Gemini 专用 Prompt
**说明**: Google Gemini 模型的专用 Prompt 变体
**对照**: Copilot `extension/prompts/node/agent/geminiPrompts.tsx`

### common/tools/

#### common/tools/quizToolsRegistry.ts
**类型**: 工具注册
**说明**: 注册所有 quiz 工具到 Core 的 ToolService
```typescript
export function registerQuizTools(service: ILanguageModelToolsService): void {
  service.registerTool(QUIZ_TOOL_READ_FILE, new ReadFileTool());
  service.registerTool(QUIZ_TOOL_EDIT_FILE, new EditFileTool());
  service.registerTool(QUIZ_TOOL_TERMINAL, new TerminalTool());
  service.registerTool(QUIZ_TOOL_SEARCH, new SearchTool());
  // ... all tools
}
```
**依赖**: `ILanguageModelToolsService`
**对照**: Copilot `extension/tools/node/allTools.ts`

#### common/tools/readFileTool.ts
**类型**: IChatTool 实现
**说明**: 读取文件内容
```typescript
export class ReadFileTool implements IChatTool {
  name = QUIZ_TOOL_READ_FILE;
  description = 'Read the contents of a file. Prefer reading large sections over many small reads.';
  inputSchema = { ... };
  
  async invoke({ parameters }: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
    const { file, startLine, endLine } = parameters;
    const content = await this.fileService.readFile(URI.file(file));
    return { content: [{ kind: 'text', value: content }] };
  }
}
```
**对照**: Copilot `extension/tools/node/` (readFile)

#### common/tools/editFileTool.ts
**类型**: IChatTool 实现
**说明**: 编辑文件内容（字符串替换）
- 支持 oldString/newString 模式
- 支持 structured edit 模式
- 失败时触发 healing 逻辑
**对照**: Copilot `extension/tools/node/` (editFile 系列)

#### common/tools/terminalTool.ts
**类型**: IChatTool 实现
**说明**: 在集成终端中执行命令
- 执行 shell 命令
- 捕获输出
- 超时控制
- 需要用户确认
**对照**: Copilot `extension/tools/node/` (runInTerminal)

#### common/tools/searchTool.ts
**类型**: IChatTool 实现
**说明**: 在工作区中搜索文本
- 使用 ripgrep 搜索
- 支持正则
- 返回匹配的文件和行号
**对照**: Copilot `extension/tools/node/` (findTextInFiles)

#### common/tools/findSymbolTool.ts
**类型**: IChatTool 实现
**说明**: 查找符号定义和引用
**对照**: Copilot `extension/tools/node/` (findSymbol)

#### common/tools/createFileTool.ts
**类型**: IChatTool 实现
**说明**: 创建新文件
**对照**: Copilot `extension/tools/node/` (createFile)

#### common/tools/deleteFileTool.ts
**类型**: IChatTool 实现
**说明**: 删除文件
**对照**: Copilot `extension/tools/node/` (deleteFile)

#### common/tools/listDirTool.ts
**类型**: IChatTool 实现
**说明**: 列出目录内容
**对照**: Copilot `extension/tools/node/` (listDir)

#### common/tools/applyPatchTool.ts
**类型**: IChatTool 实现
**说明**: 应用 patch/diff
**对照**: Copilot `extension/tools/node/applyPatch/`

#### common/tools/codebaseTool.ts
**类型**: IChatTool 实现
**说明**: 获取代码库概览信息
**对照**: Copilot `extension/tools/node/codebaseTool.tsx`

#### common/tools/executionSubagentTool.ts
**类型**: IChatTool 实现
**说明**: 执行子 agent 任务
**对照**: Copilot `extension/tools/node/executionSubagentTool.ts`

### common/intents/

#### common/intents/intentTypes.ts
**类型**: 类型定义
**说明**: 意图枚举和类型
```typescript
export enum QuizIntent {
  Explain = 'explain',    // 解释代码
  Review = 'review',      // 代码审查
  Tests = 'tests',        // 生成测试
  Fix = 'fix',            // 修复错误
  New = 'new',            // 生成新代码
  Terminal = 'terminal',  // 终端命令
  Workspace = 'workspace',// 工作区操作
  Edit = 'edit',          // 编辑代码
  Agent = 'agent',        // 完全自主模式
  Ask = 'ask',            // 一般问答
}

interface IntentClassification {
  intent: QuizIntent;
  confidence: number;
}
```
**对照**: Copilot `extension/intents/`

#### common/intents/intentService.ts
**类型**: 服务
**说明**: 意图分类服务
```typescript
export interface IIntentService {
  classify(message: string): Promise<IntentClassification>;
}

export class IntentService implements IIntentService {
  // 方法1: 基于关键词/规则
  // 方法2: 基于 LLM 分类
  // 方法3: 混合模式
}
```
**对照**: Copilot `extension/intents/intentService.ts`

#### common/intents/intentHandlers.ts
**类型**: 处理器注册
**说明**: 每个意图对应的处理器
```typescript
export const intentHandlers: Map<QuizIntent, IntentHandler> = new Map([
  [QuizIntent.Explain, new ExplainHandler()],
  [QuizIntent.Fix, new FixHandler()],
  [QuizIntent.Tests, new TestsHandler()],
  // ...
]);
```
**对照**: Copilot `extension/intents/intentHandler.ts`

### common/context/

#### common/context/workspaceContext.ts
**类型**: 上下文 Provider
**说明**: 收集工作区上下文信息：
- 项目结构
- 打开的文件
- 活动编辑器
- 技术栈检测
**对照**: Copilot `extension/context/`, `extension/chatSessionContext/`

#### common/context/editorContext.ts
**类型**: 上下文 Provider
**说明**: 收集编辑器上下文：
- 当前文件内容
- 选中代码
- 光标位置
- 可见范围
**对照**: Copilot `extension/context/`

#### common/context/gitContext.ts
**类型**: 上下文 Provider
**说明**: 收集 Git 上下文：
- 当前分支
- 最近的 commit
- 修改的文件
- Git diff
**依赖**: `IGitService`
**对照**: Copilot `platform/git/`

#### common/context/diagnosticsContext.ts
**类型**: 上下文 Provider
**说明**: 收集诊断信息（错误/警告）
**依赖**: `IMarkerService`
**对照**: Copilot `extension/diagnosticsContext/`

#### common/context/quizContextProvider.ts
**类型**: 上下文 Provider
**说明**: quiz 专用上下文整合器
- 聚合所有上下文 Provider
- 根据意图选择相关上下文
- 管理上下文优先级
**对照**: Copilot 的上下文收集逻辑

### common/quizConfiguration.ts
**类型**: 配置管理
**说明**: quiz 设置管理
```typescript
export interface IQuizConfiguration {
  enabled: boolean;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
  maxTokens: number;
  temperature: number;
  customInstructions?: string;
  // ...
}
```
**对照**: Copilot `extension/configuration/`

---

## electron-browser/ -- Electron 特有

### electron-browser/quizNativeService.ts
**类型**: 原生服务
**说明**: Electron 环境下的原生功能（如本地文件系统增强、原生认证等）
**对照**: Copilot 的 node-specific 代码

---

## test/ -- 测试

### test/common/quizService.test.ts
**说明**: quizService 的单元测试

### test/common/tools.test.ts
**说明**: 工具的单元测试

### test/common/prompts.test.ts
**说明**: Prompt 渲染的单元测试

### test/common/intents.test.ts
**说明**: 意图分类的单元测试

### test/browser/quizWidget.test.ts
**说明**: UI 组件的集成测试

---

## 文件统计

| 类别 | 文件数 | 说明 |
|---|---|---|
| browser/ | 9 个 | UI 层，大部分复用 Core |
| common/ | ~35 个 | 业务逻辑，quiz 主要实现 |
| electron-browser/ | 1 个 | Electron 特有 |
| test/ | 5 个 | 测试 |
| **总计** | **~50 个文件** | |

### 实现工作量分级

| 级别 | 文件 | 说明 |
|---|---|---|
| **简单 (配置/注册)** | ~10 个 | contribution.ts, constants.ts, actions, 品牌 CSS |
| **中等 (适配/整合)** | ~15 个 | quizAgent.ts, context providers, 简单工具 |
| **复杂 (核心逻辑)** | ~15 个 | quizServiceImpl, Prompt 组件, 复杂工具, IntentService |
| **高级 (可选)** | ~10 个 | 模型专用 Prompt, embeddings, BYOK |
