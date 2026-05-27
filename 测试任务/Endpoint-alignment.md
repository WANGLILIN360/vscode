# Quiz vs Copilot Endpoint 测试对齐报告

> 对照文件：`quizEndpoint.test.ts` ↔ Copilot `endpoints.test.ts`

## 一、测试用例一比一对照

### Suite 1: Model Name Constants ↔ Copilot "Endpoint Class Test — Model names have proper casing"

| Copilot 用例 | Quiz 对应用例 | 状态 |
|-------------|-------------|------|
| `Model names have proper casing` (GPT41, GPT4OMINI) | `Model name constants have correct values` (EducateV1, ChallengeV1, ReviewV1) | ✅ 对齐 |
| _(无)_ | `QUIZ_MODELS list matches all model constants` | ➕ Quiz 扩展 |

### Suite 2: EndpointProvider — model override / fallback ↔ Copilot "ProductionEndpointProvider — utility model overrides"

| Copilot 用例 | Quiz 对应用例 | 状态 |
|-------------|-------------|------|
| no override → falls through to default | no override → falls through to default model endpoint | ✅ 一比一 |
| copilot-vendor override resolves to matching model | quiz-vendor override resolves to matching registered endpoint | ✅ 一比一 |
| copilot-vendor override falls back when no match | quiz-vendor override falls back when no registered model matches | ✅ 一比一 |
| copilot-vendor override falls back when ambiguous (多匹配) | _(省略，Quiz 用 Map 注册不会多匹配)_ | ⚠️ 合理省略 |
| malformed override falls back to default | malformed override falls back to default | ✅ 一比一 |
| non-string override values fall back | _(省略，Quiz override 是 modelId 字符串)_ | ⚠️ 合理省略 |
| configuration change fires onDidModelsRefresh | configuration change fires onDidEndpointsChange | ✅ 一比一 |
| non-copilot vendor → extension-contributed endpoint | non-quiz vendor → registered BYOK endpoint | ✅ 一比一 |
| non-copilot vendor falls back when no matches | non-quiz vendor falls back when no registered endpoint matches | ✅ 一比一 |
| non-copilot vendor falls back when ambiguous | _(省略，同上)_ | ⚠️ 合理省略 |
| non-copilot vendor falls back when selectChatModels throws | non-quiz vendor falls back when endpoint throws | ✅ 一比一 |

### Suite 3: EndpointProvider — register/unregister/list (Quiz 独有)

| 用例 | 说明 | Copilot 对应 |
|------|------|-------------|
| constructor pre-populates default endpoints | 验证 3 个默认端点 | ❌ 无对应 |
| registerEndpoint adds a new endpoint | 注册新端点 | ❌ 无对应 |
| unregisterEndpoint removes an endpoint | 注销端点 | ❌ 无对应 |
| registerEndpoint overwrites existing endpoint | 覆盖已有端点 | ❌ 无对应 |

### Suite 4: EndpointProvider — resolveEndpointUrl (Quiz 独有)

| 用例 | 说明 | Copilot 对应 |
|------|------|-------------|
| resolves URL for known model with apiVersion | 已知模型+版本号 | ❌ 无对应 |
| resolves URL using prefix heuristic | gpt-/claude-/gemini- 前缀推断 | ❌ 无对应 |
| resolves URL for claude/gemini prefix | 各前缀推断 | ❌ 无对应 |
| resolves empty URL for unknown prefix | 未知前缀返回空 | ❌ 无对应 |
| apiVersion is appended to URL | 版本号追加 | ❌ 无对应 |
| trailing slash removed before appending apiVersion | 尾斜杠处理 | ❌ 无对应 |

### Suite 5: IQuizEndpoint — availability, streaming, cancellation (Quiz 独有)

| 用例 | 说明 | Copilot 对应 |
|------|------|-------------|
| initial availability is true | 可用性初始值 | ❌ 无对应 |
| setAvailability fires event | 可用性变更事件 | ❌ 无对应 |
| sendChatRequest streams complete response | 流式响应完整性 | ❌ 无对应 |
| sendChatRequest streams text in parts | 文本分片 | ❌ 无对应 |
| sendChatRequest respects cancellation | 取消支持 | ❌ 无对应 |
| sendChatRequest increments request count | 请求计数 | ❌ 无对应 |
| getModels returns QUIZ_MODELS list | 模型列表 | ❌ 无对应 |
| refreshModels resets request count | 刷新模型 | ❌ 无对应 |
| multiple sequential requests | 连续请求 | ❌ 无对应 |
| cancellation before any chunk | 预取消 | ❌ 无对应 |

## 二、架构差异说明

| 维度 | Copilot | Quiz | 差异原因 |
|------|---------|------|----------|
| **端点发现** | `IModelMetadataFetcher` + `lm.selectChatModels` | `registerEndpoint` Map 注册 | Extension→Core 差异 |
| **模型覆盖** | `configService.setNonExtensionConfig('chat.utilityModel', 'copilot/gpt-4o-mini')` | `provider.setModelOverride('gpt-4o-mini')` | 配置系统差异 |
| **扩展端点** | `ExtensionContributedChatEndpoint` + `vscode.lm` API | BYOK `registerEndpoint` | 平台 API 差异 |
| **歧义处理** | 多匹配回退（Copilot 特有） | Map 注册不会多匹配 | 合理省略 |
| **非字符串值** | 用户可编辑 settings.json | override 是代码设置 | 合理省略 |

## 三、修复的源码问题

| 文件 | 修复内容 |
|------|----------|
| `quizEndpoint.ts` | `readonly IQuizModelInfo` → `readonly IQuizModelInfo[]`（接口返回数组） |
| `quizEndpointImpl.ts` | 匹配接口 `readonly IQuizModelInfo[]` |
| `quizNativeEndpoint.ts` | 匹配接口 + `*_errorStream`/`*_emptyStream` 改为 `async *` |
| `quizTypes.ts` | 添加 `export { type IQuizModelInfo } from './quizLanguageModels.js'` |

## 四、测试统计

| 维度 | Copilot | Quiz |
|------|---------|------|
| **Suite 数** | 2 | 5 |
| **用例数** | 11 | 30 |
| **覆盖范围** | 模型覆盖/回退 | 模型常量 + 覆盖/回退 + 注册/注销 + URL 解析 + 流式/取消 |
| **一比一对齐** | 8/11 | 8/11 (3 个合理省略) |

## 五、总结

- **一比一对齐率**：8/11 Copilot 用例有直接对应（73%），3 个省略均为合理架构差异
- **Quiz 扩展覆盖**：19 个 Quiz 独有用例，覆盖 Copilot 未测试的注册/URL 解析/流式响应
- **源码修复**：4 个文件的类型/接口问题已修复
- **零警告**：测试文件无 IDE 警告
