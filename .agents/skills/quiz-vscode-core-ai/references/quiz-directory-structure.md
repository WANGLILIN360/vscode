# quiz 目录结构（Core Contribution）

## 关键决策

quiz 实现为 VS Code **Core Contribution**，不是 Extension。

**正确路径：** `src/vs/workbench/contrib/quiz/`
**错误路径：** `extensions/quiz/` （这是扩展，不是我们要的）

## 为什么是 contrib/quiz/ 而不是扩展

- Copilot Chat 扩展源码现已直接内嵌在 VS Code 仓库的 `extensions/copilot/` 中
- 微软正在将其核心业务逻辑逐步迁移到 `src/vs/workbench/contrib/chat/`
- quiz 一步到位：直接在 Core 中实现，不走扩展路径
- Core contribution 享有完整内部 API 访问权限，无需通过 Extension API 间接调用

## 完整目录结构

```
src/vs/workbench/contrib/quiz/
├── browser/                          # UI 层
│   ├── quiz.contribution.ts         # 模块注册（类比 chat.contribution.ts）
│   ├── media/
│   │   └── quiz.css                 # quiz 品牌样式
│   ├── quizAgentView.ts             # Chat 面板 ViewPane
│   ├── quizWidget.ts               # 主聊天 Widget
│   ├── quizInputPart.ts            # 输入区域（附件、工具栏）
│   ├── quizEditingWidget.ts        # 代码编辑 Keep/Undo UI
│   ├── quizStatusBar.ts            # 状态栏图标
│   ├── actions/
│   │   └── quizActions.ts          # 所有 Actions 注册
│   └── prompts/
│       └── promptRenderer.ts       # TSX Prompt 渲染适配
├── common/                           # 业务逻辑层
│   ├── quizService.ts              # 主服务接口 IQuizService
│   ├── quizServiceImpl.ts          # 服务实现
│   ├── quizAgent.ts                # Agent/Participant 注册
│   ├── quizLanguageModel.ts        # LLM Provider 注册
│   ├── quizSessions.ts             # Session 管理
│   ├── constants.ts                # 常量、枚举（Intents, Modes）
│   ├── model/
│   │   ├── quizRequestModel.ts     # 请求模型
│   │   └── quizResponseModel.ts    # 响应模型
│   ├── prompts/                    # TSX Prompt 工程
│   │   ├── quizAgentPrompt.tsx     # Agent 模式主 Prompt
│   │   ├── quizPanelPrompt.tsx     # Panel 模式 Prompt
│   │   ├── quizInlinePrompt.tsx    # Inline 模式 Prompt
│   │   ├── base/
│   │   │   ├── identity.tsx        # quiz 身份定义
│   │   │   ├── toolInstructions.tsx # 工具使用指令
│   │   │   └── workspaceContext.tsx # 工作区上下文
│   │   ├── registry/
│   │   │   ├── promptRegistry.ts   # Prompt 路由注册表
│   │   │   ├── anthropicPrompts.tsx # Claude 专用 Prompt
│   │   │   ├── openaiPrompts.tsx   # GPT 专用 Prompt
│   │   │   └── geminiPrompts.tsx   # Gemini 专用 Prompt
│   │   └── utils/
│   │       └── conversationHistory.tsx # 对话历史管理
│   ├── tools/                      # 工具实现
│   │   ├── quizToolsService.ts     # 工具服务注册
│   │   ├── readFileTool.ts        # 读取文件
│   │   ├── editFileTool.ts        # 编辑文件
│   │   ├── terminalTool.ts        # 终端命令
│   │   ├── searchTool.ts          # 代码搜索
│   │   ├── findSymbolTool.ts      # 符号查找
│   │   ├── createFileTool.ts      # 创建文件
│   │   └── deleteFileTool.ts      # 删除文件
│   ├── intents/                    # 意图识别系统
│   │   ├── intentService.ts       # 意图分类服务
│   │   ├── intentHandlers.ts      # 处理器注册
│   │   └── intentTypes.ts         # 类型定义
│   └── context/                    # 上下文收集
│       ├── workspaceContext.ts    # 工作区信息
│       ├── editorContext.ts       # 编辑器状态
│       └── quizContextProvider.ts # 上下文 Provider
├── electron-browser/               # Electron 特有（如有）
│   └── quizNativeService.ts      # 原生服务
└── test/                           # 测试
    ├── common/
    │   ├── quizService.test.ts
    │   ├── tools.test.ts
    │   └── prompts.test.ts
    └── browser/
        └── quizWidget.test.ts
```

## 与 VS Code Core 的集成点

### 1. 在 workbench 中注册

```typescript
// src/vs/workbench/workbench.common.main.ts
import 'vs/workbench/contrib/quiz/browser/quiz.contribution';
```

### 2. quiz.contribution.ts 职责

类比 `chat/browser/chat.contribution.ts`，quiz 的 contribution 负责：
- 注册 ViewPane（quiz Chat 面板）
- 注册 Commands 和 Actions
- 注册 Keybindings
- 注册 Settings
- 注册 Context Keys
- 注册 Language Model Provider
- 注册 Chat Participant/Agent
- 注册 Tools
- 注册 Services（IQuizService）

### 3. 复用 chat 基础设施

quiz 直接复用 `contrib/chat/` 提供的基础设施：

```typescript
// quiz 内部可以直接 import chat 的模块
import { IChatService } from 'vs/workbench/contrib/chat/common/chatService/chatService';
import { IChatWidgetService } from 'vs/workbench/contrib/chat/browser/chat';
import { ChatAgentLocation } from 'vs/workbench/contrib/chat/common/constants';
import { renderPrompt } from 'vs/workbench/contrib/chat/common/prompts/promptTsx';
```

### 4. quiz 作为 Chat Participant

quiz 注册为 chat 系统的一个 participant：

```typescript
// quiz/browser/quizAgent.ts
import { IChatAgentService } from 'vs/workbench/contrib/chat/common/participants/chatAgents';

class QuizAgent {
  constructor(
    @IChatAgentService chatAgentService: IChatAgentService
  ) {
    chatAgentService.registerAgent({
      id: 'quiz',
      name: 'quiz',
      isDefault: true,
      locations: [ChatAgentLocation.Panel, ChatAgentLocation.Editor],
      metadata: { description: 'quiz AI coding assistant' }
    }, {
      invoke: async (request, context, response, token) => {
        // quiz 核心逻辑
      }
    });
  }
}
```

## 代码不是扩展示例

对比明确一下区别：

| | Core Contribution | Extension |
|---|---|---|
| 路径 | `src/vs/workbench/contrib/quiz/` | `extensions/quiz/` |
| API | 直接 internal API | `vscode.*` public API |
| 服务 | `@IChatService` DI | `vscode.lm.*` |
| Prompt | `renderPrompt()` 直接调用 | 通过 Extension API |
| 工具 | `ILanguageModelToolsService` | `vscode.lm.registerTool()` |
| 构建 | 和 VS Code 一起编译 | 单独 esbuild |

## 品牌隔离

所有 quiz 特有的代码都在 `contrib/quiz/` 中，不影响 `contrib/chat/` 的通用基础设施：
- chat = 通用聊天基础设施（框架）
- quiz = 具体 AI 助手实现（业务）

这类似于：
- `contrib/debug/` = 调试框架
- `contrib/testing/` = 测试框架
- `contrib/git/` = Git 集成
- `contrib/quiz/` = quiz AI 助手
