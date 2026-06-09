# Chronofact Evidence Workbench 设计

## 1. 设计结论

Chronofact 前端不复用 NeoSpectra Workbench。

NeoSpectra Workbench 的三栏工作台、shell projection、surface composition 等思路有参考价值，但它当前绑定了 NeoSpectra / PPT / studio / source / artifact 等业务语义。直接搬过来会让 Chronofact 的证据系统被旧业务概念污染，也会带来大量不必要的迁移成本。

Chronofact 应该新建一个独立的 Evidence Workbench。它的产品核心不是课件生成工作台，而是可信证据管理工作台。

推荐技术路线：

```text
Next.js / React
  + CopilotKit
  + shadcn/ui
  + TanStack Query
  + browser SHA-256 worker
```

其中：

- CopilotKit 负责 AI Agent 交互、tool call 展示、human-in-the-loop 交互。
- shadcn/ui 负责普通业务界面组件。
- TanStack Query 负责 Chronofact / Limora / Chronestia / Noeryn API 状态管理。
- 浏览器 worker 负责本地文件 SHA-256 计算，避免大文件阻塞主线程。

## 2. 为什么不复用 NeoSpectra Workbench

NeoSpectra Workbench 的可取之处是“工作台思路”，不是具体代码。

可借鉴：

- 多区域工作台布局
- 左侧/右侧辅助面板
- shell projection 思路
- 工具调用、系统状态和可用能力的可视化
- agent 与业务界面的并列展示

不应复用：

- PPT / studio 语义
- teaching source / library / project artifact 语义
- 旧的 source management 流程
- NeoSpectra 项目 store
- 课件生成相关面板
- 与证据管理无关的复杂动效和历史兼容逻辑

Chronofact 需要的是 evidence / proof / receipt / trace / review，而不是 studio / slide / source / courseware。

## 3. 外部 Agent 前端框架选择

### 推荐：CopilotKit

CopilotKit 更适合作为 Chronofact 的 Agent 前端层。

原因：

- 它定位为 agentic user experience 前端栈。
- 支持 chat、generative UI、shared state 和 human-in-the-loop。
- 可以连接 AG-UI compatible backend。
- 与 Noeryn 的 AgentRun、ToolCall、Checkpoint、Trace 模型方向接近。
- 适合把工具调用和人工确认内嵌到用户工作流里。

Chronofact 的 Agent Panel 可以使用 CopilotKit 承担：

- 用户自然语言提问
- agent tool call 展示
- 证据查询结果解释
- checkpoint 确认
- 报告生成前确认
- tool trace 的用户可见投影

### 可选：assistant-ui

assistant-ui 更适合做高质量聊天组件。

它适合：

- ChatGPT 风格消息流
- thread / message state
- tool UI
- multi-agent chat UI

但 Chronofact 的核心不是聊天框，而是证据工作台。assistant-ui 可以作为备选聊天组件，但不作为第一版架构核心。

### 可选：Vercel AI Elements

Vercel AI Elements 更像 AI UI 组件库。

它适合：

- message
- response
- prompt input
- reasoning
- tool display
- citation

如果未来使用 Vercel AI SDK，可以考虑局部引入。但第一版不应让前端架构依赖 Vercel AI SDK 的数据流。

## 4. 工作台信息架构

Evidence Workbench 应该围绕真实证据场景组织，而不是围绕技术对象堆字段。

推荐三栏结构：

```text
┌──────────────────┬──────────────────────────────┬──────────────────────┐
│ Evidence Space   │ Evidence Console             │ Agent Panel          │
│                  │                              │                      │
│ 组织空间          │ 文件上传 / 校验                │ AI 问答               │
│ 文件列表          │ SHA-256 指纹                  │ Tool Call            │
│ 状态筛选          │ Evidence detail              │ Explanation          │
│ proof missing    │ Version timeline              │ Risk / Next checks   │
│ pending queue    │ Receipt / Trace / Tx          │ Checkpoint           │
└──────────────────┴──────────────────────────────┴──────────────────────┘
```

### Evidence Space

左侧区域负责证据空间导航：

- 当前 organization
- evidence 列表
- 状态筛选
- digest 搜索
- proof missing 快速入口
- pending confirmation 快速入口
- mismatch / proof unavailable 快速入口

左侧不展示大段说明文字，只提供扫描和定位能力。

### Evidence Console

中间区域负责当前任务：

- 上传文件
- 本地计算 SHA-256
- preserve evidence
- verify file
- evidence detail
- version timeline
- receipt status
- EVM transaction hash
- event log / block number / confirmation count

用户最核心的判断应该在这里完成：

```text
这个文件是否已存证？
当前 hash 是否匹配？
链上 proof 是否可用？
这个版本和上一版是什么关系？
```

### Agent Panel

右侧区域负责 AI Agent 操作：

- 自然语言查询
- AI explanation
- risk summary
- next checks
- evidence basis
- tool call cards
- checkpoint confirmation

Agent Panel 必须明确显示：

```text
AI 解释不构成真实性证明，证明来源是结构化证据、回执、trace 和链上交易。
```

## 5. Agent Tool 设计

Chronofact 不把业务语义写进 Noeryn core。Chronofact 通过外层 adapter 向 Noeryn / CopilotKit 暴露工具。

第一版工具：

```text
chronofact.evidence.query
chronofact.evidence.verify
chronofact.evidence.timeline
chronofact.receipt.refresh
chronofact.proof.scan_missing
chronofact.report.draft
chronofact.report.export
```

### 可自动执行工具

这些工具是 read-only 或低风险操作，可以自动执行：

- `chronofact.evidence.query`
- `chronofact.evidence.verify`
- `chronofact.evidence.timeline`
- `chronofact.proof.scan_missing`

它们仍然需要记录：

- tool name
- input summary
- output summary
- truth owner
- evidence refs
- trace metadata

### 需要人工确认的工具

这些工具有外部影响或正式输出，必须进入 checkpoint：

- 提交新的 evidence
- 批量刷新 receipt
- 导出正式报告
- 删除、撤销、归档 evidence
- 修改 organization 级证据配置

Agent 可以建议这些操作，但不能绕过用户确认。

## 6. 前端与服务边界

Chronofact Evidence Workbench 只负责展示和用户交互，不拥有核心事实。

边界如下：

```text
Limora
  -> session / identity / organization / permission

Chronofact API
  -> evidence / asset / version / verification result / report

Chronestia
  -> fact / receipt / trace / blockchain transaction

Noeryn
  -> agent run / step / tool call / memory / checkpoint

CopilotKit
  -> agent UI / chat / human-in-the-loop projection
```

前端不得：

- 自己判断 proof 是否真实
- 自己生成 receipt
- 把 AI 输出当成证明
- 在本地维护不可追踪的业务真相
- 绕过 Limora 权限调用高风险接口

前端可以：

- 本地计算 SHA-256
- 展示 evidence 状态
- 发起 preserve / verify 请求
- 展示 receipt / trace / transaction
- 展示 AI explanation
- 让用户确认 checkpoint

## 7. 首版页面任务

第一版 Evidence Workbench 不追求功能多，而追求主链路真实、清楚、可演示。

必须支持：

1. 登录后选择 organization。
2. 上传文件并本地计算 SHA-256。
3. 提交存证。
4. 展示 evidence 记录和 digest。
5. 展示 Chronestia receipt / trace / EVM transaction hash。
6. 再次上传同文件，验证为 preserved。
7. 上传篡改文件，验证为 not_preserved 或 mismatch。
8. AI 解释当前验证结果。
9. 展示 evidence basis。
10. 高风险操作出现 human confirmation。

暂不做：

- 大规模证据图谱
- 多租户管理后台
- 复杂 report designer
- 完整 Stratumind 检索
- 自定义表单 builder
- 前端本地模拟区块链

## 8. 设计风格

Chronofact Evidence Workbench 应该像证据管理工具，而不是营销页或课程 PPT。

视觉方向：

- 安静、可信、专业
- 高信息密度，但不堆噪音
- 少用大面积渐变和装饰
- 状态颜色明确区分 preserved / pending / mismatch / unavailable
- proof 和 AI explanation 分区清楚
- 交易 hash、digest、receipt 等技术字段可复制、可折叠、可追溯

用户第一眼应该能知道：

```text
我在哪个证据空间？
当前文件 hash 是什么？
它是否已存证？
证明来自哪里？
AI 只是解释还是已经调用了工具？
下一步需要我确认什么？
```

## 9. 推荐实现顺序

### Step 1：新建独立前端

新建 Chronofact 专用 frontend，不从 NeoSpectra Workbench 复制业务代码。

推荐：

```text
services/evidence-workbench
```

技术栈：

- Next.js
- React
- TypeScript
- shadcn/ui
- TanStack Query
- CopilotKit

### Step 2：先接真实 Chronofact API

先实现不用 AI 也能跑通的证据主链路：

- organization selection
- file hash
- preserve
- verify
- evidence list
- evidence detail

### Step 3：接入 AI explanation

把现有 AI explanation 输出展示到右侧 Agent Panel：

- summary
- risks
- next_checks
- confidence_note
- evidence_basis

### Step 4：接 Noeryn + CopilotKit

将 Agent Panel 从静态解释升级为真实 agent flow：

- 用户提问
- Noeryn 创建 AgentRun
- 调用 Chronofact host tools
- 返回 tool trace
- 需要确认时进入 checkpoint
- CopilotKit 展示人机交互

### Step 5：扩展证据治理能力

继续增加：

- proof missing 扫描
- pending queue
- batch verification
- report draft
- report export
- organization evidence health overview

## 10. 核心原则

- 不复用 NeoSpectra Workbench 业务代码。
- 可以借鉴其工作台思想，但 Chronofact 必须拥有自己的 evidence UI 语言。
- CopilotKit 用作 Agent 前端层，不作为证据真相来源。
- AI 只做查询、解释、整理和建议。
- 证明来自 hash、receipt、trace、transaction 和结构化记录。
- 高风险操作必须可审计、可确认、可追踪。
- 前端不重新发明业务真相，只投影后端和 Agent Runtime 的结果。
