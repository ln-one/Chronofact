# Chronofact 未来规划设计

## 1. 核心判断

Chronofact 不应该停留在“上传文件、计算哈希、写入链上”的课程演示层面。这个方向真正有价值的地方，是把可信证据系统做成一个可持续维护、可查询、可解释、可审计的智能证据管理平台。

传统存证系统通常只解决“有没有把某个摘要登记下来”的问题，但真实使用时更麻烦的是后续管理：证据越来越多以后，用户需要知道哪些材料已经确认、哪些还缺少证明、哪些版本发生过变化、为什么校验失败、哪里需要人工复核。如果这些工作都靠人手动查询和整理，系统本身就很难变成真正有用的基础设施。

因此 Chronofact 的未来方向不是单纯做一个区块链存证 demo，而是做一个“可信证明 + 智能体治理 + 大数据证据管理”的综合系统。区块链提供不可篡改的证明锚点，后端保存结构化证据记录，AI Agent 负责查询、整理、解释和辅助复核，但不直接拥有证明真相。

## 2. 系统定位

Chronofact 的长期定位是一个 agent-assisted evidence governance system，即 AI 辅助的可信证据治理系统。

它的底层逻辑是：

```text
文件 / 内容
  -> SHA-256 数字指纹
  -> 证据记录与版本关系
  -> Chronestia 存证事实
  -> 链上交易 / 回执 / trace
  -> AI Agent 查询、解释、整理、提示风险
  -> 人工复核与报告输出
```

这里必须坚持一个边界：AI 不是证明来源。AI 不能生成 digest，不能篡改 receipt，不能把失败解释成成功，也不能替代人或系统裁决真实性。AI 的价值是把结构化证据变成用户能理解、能操作、能追踪的说明和流程。

最终证明来源仍然是：

- 文件 SHA-256 digest
- Chronofact evidence / version 记录
- Chronestia fact / receipt / trace
- EVM 交易 hash、事件日志和交易回执
- Limora 权限与审计记录
- Noeryn agent run / tool call / checkpoint trace

## 3. 微服务边界

未来架构必须保持服务边界清晰，避免把所有语义塞进一个大系统里。

### Chronofact

Chronofact 是产品业务编排层，负责证据、文件、版本、校验、报告和用户可见状态。

它可以理解：

- evidence
- asset
- version
- digest
- verification result
- report
- review task

Chronofact 不应该把身份、链上证明、智能体过程真相全部吸收到自己内部。它负责把这些能力编排成用户能理解的证据工作流。

### Chronestia

Chronestia 是通用存证内核，负责 fact、receipt、trace 和链上锚定。

它只关心“某个事实摘要是否被登记、是否有回执、是否可验证”，不关心这个事实来自课程报告、成绩单、合同还是其他业务材料。

链上只写 digest 和必要的证明元数据，不写原文件，也不写敏感业务内容。

### Limora

Limora 是身份与权限服务。它的核心抽象是“没有角色，只有显式权限授予”。

Chronofact 可以定义自己的权限命名空间，例如：

- `chronofact.evidence.create`
- `chronofact.evidence.read`
- `chronofact.evidence.verify`
- `chronofact.evidence.report.export`

但 Limora 不应该理解老师、学生、课程、管理员这类产品角色。角色只是消费方自己组织权限组合时使用的外部标签，不是 Limora 内核事实。

### Noeryn

Noeryn 是通用 Agent Runtime，负责智能体运行过程，而不是 Chronofact 业务真相。

它拥有：

- AgentRun
- AgentStep
- ToolCall
- Memory
- Checkpoint
- Trace
- tool governance

Noeryn 不应该写死 Chronofact 专用逻辑。Chronofact 未来通过外层 adapter 暴露工具，例如：

- `chronofact.evidence.query`
- `chronofact.evidence.verify`
- `chronofact.evidence.timeline`
- `chronofact.report.draft`

Noeryn 只负责调用工具、记录过程、处理权限提示、在高风险操作前创建人工确认 checkpoint。

### Stratumind

Stratumind 可以作为未来的检索和证据打包层，用于处理大规模证据空间中的搜索、聚合、上下文构建和来源引用。

它适合承担：

- evidence retrieval
- source-grounded context packing
- batch evidence summarization
- similar record search
- missing proof discovery

但它同样不应该成为证明来源。检索结果只是辅助，最终仍要回到结构化记录和 proof。

## 4. 智能体层的价值

Chronofact 引入 AI Agent 的目的不是为了让系统看起来更“AI”，而是解决证据系统真正的使用成本问题。

未来用户不应该只面对一堆表格、hash、receipt 和 transaction hash。用户更可能提出这些问题：

- “这个文件有没有被存证？”
- “为什么这次校验失败？”
- “这批材料里哪些还没有链上确认？”
- “哪个版本是最新的？”
- “这个文件和上一次提交有什么关系？”
- “帮我生成一份复核报告，但标明证明来源。”
- “把所有 proof missing 的记录列出来，提醒我下一步该做什么。”

这些问题如果完全靠人工点页面、查接口、对 hash，会非常费力。AI Agent 可以把这些分散操作串起来：

```text
用户问题
  -> Noeryn 创建 AgentRun
  -> 调用 Chronofact evidence query tool
  -> 调用 Chronestia receipt / trace 查询
  -> 汇总结构化 verification result
  -> 生成中文解释、风险提示、下一步复核建议
  -> 必要时等待人工确认
```

这样 AI 的强项是理解问题、组织流程、生成说明和降低操作成本；区块链和后端结构化记录负责可信证明。

## 5. 区块链设计重点

区块链在 Chronofact 里的价值不是“把文件放上链”，而是提供一个外部不可篡改的时间与事实锚点。

当前和未来都应该坚持：

- 不把原文件上链
- 不把敏感业务内容上链
- 只锚定稳定 digest 和必要证明元数据
- 链上事件用于证明某个 digest 在某个时间被提交
- 业务解释仍由 Chronofact 和结构化 evidence record 负责

一条典型链路是：

```text
用户上传文件
  -> Chronofact 计算 SHA-256
  -> Chronofact 创建 evidence version
  -> Chronestia 注册 fact_digest
  -> EVM provider 调用 Solidity 合约
  -> 合约 emit FactAnchored 事件
  -> Chronestia 刷新 receipt 为 confirmed
  -> Chronofact 展示交易凭证和验证状态
```

用户看到的不是“神秘链上编号”，而应该是明确状态：

- 已存证：digest 匹配，receipt/trace 可用
- 未存证：组织空间内没有该 digest
- 内容不匹配：指定 proof/version 与当前文件 digest 不一致
- 待确认：记录存在，但链上确认还未完成
- 证明不可用：链或存证服务暂时不可达

## 6. 产品演进路线

前端产品形态采用独立的 Chronofact Evidence Workbench，不复用 NeoSpectra Workbench 业务代码。NeoSpectra 的工作台思想可以作为参考，但 Chronofact 需要自己的 evidence / proof / receipt / trace / review UI 语言。具体设计见 [evidence-workbench-design.md](./evidence-workbench-design.md)。

### Phase 1：真实主链路闭环

目标是把系统从 demo 变成可解释的最小真实产品。

需要完成：

- Limora 登录与组织权限接入
- 文件/内容 SHA-256 计算
- evidence / version 记录
- Chronestia fact 注册
- EVM/Ganache 链上锚定
- 文件再次上传后的 digest 校验
- 明确返回 preserved / not_preserved / mismatch / pending / proof_unavailable
- 前端只展示用户能理解的状态，不倾倒后端对象

### Phase 2：AI 解释层标准化

目标是让 AI 输出稳定、可控、不越界。

AI 输入只允许来自结构化证据：

- evidence metadata
- version history
- verification result
- receipt status
- trace status
- chain transaction metadata

AI 输出固定为：

- summary
- risks
- next_checks
- confidence_note
- evidence_basis

AI 必须明确说明：解释不构成真实性证明，证明来源是结构化记录和链上/存证回执。

### Phase 3：Noeryn Agent 接入

目标是让 Chronofact 拥有真正的智能体操作层。

Chronofact 外层 adapter 向 Noeryn 暴露通用工具：

- evidence 查询
- digest 校验
- receipt 刷新
- trace 查询
- proof missing 扫描
- 报告草稿生成

Noeryn 负责：

- 记录 AgentRun
- 记录 ToolCall
- 记录输入输出摘要
- 记录 tool governance decision
- 对高风险动作创建 checkpoint
- 脱敏 token、cookie、authorization、secret 等敏感字段

### Phase 4：大数据证据治理

目标是从单文件校验扩展到组织级证据管理。

可以继续扩展：

- 批量证据状态扫描
- 多版本时间线分析
- 重复 digest / 相似记录发现
- proof missing 自动归类
- chain unavailable 风险报告
- 组织级证据健康度 dashboard
- 人工复核任务列表
- 可导出的审计报告

### Phase 5：通用 evidence infrastructure

长期目标是让 Chronofact 不只服务课程材料，而能接入更多业务场景。

可以支持：

- 课程实验报告
- 成绩单与证明材料
- 合同文件
- 项目交付物
- 数据集版本
- 代码归档
- 审计材料

关键是业务语义留在 Chronofact 或消费方，Chronestia、Limora、Noeryn 继续保持通用。

## 7. 技术创新点

Chronofact 的创新点不是“用了 AI”或“用了区块链”，而是把两者放在正确的位置上。

区块链擅长的是不可篡改、可追溯、外部可验证；AI 擅长的是理解意图、组织信息、降低查询和维护成本。但 AI 本身不稳定，也不应该拥有高权限和最终裁决权。因此系统需要一个 Agent Runtime 来约束 AI 的操作过程。

这个组合形成了三层结构：

```text
可信证明层：digest / receipt / trace / chain event
业务治理层：evidence / version / organization / permission / audit
智能操作层：agent query / explanation / report / checkpoint / tool trace
```

这样既能利用 AI 的能力，又不会让 AI 破坏证据系统的可信边界。

## 8. 必须坚持的设计原则

- AI 不是证明来源。
- 区块链不是文件存储。
- 原文件和敏感业务数据不上链。
- 子服务必须保持通用，不被 Chronofact 宿主语义污染。
- Limora 内部没有角色，只有权限授予。
- Noeryn 内部没有 Chronofact 专用工具，只有 host capability adapter。
- Chronestia 只负责 fact / receipt / trace，不理解业务文件。
- 前端展示应该围绕用户场景，而不是堆接口字段。
- 所有高风险 Agent 操作必须可追踪，必要时进入人工确认。
- 最终报告必须能回溯到结构化 evidence basis。

## 9. 最终愿景

Chronofact 最终要做的不是一个普通“学生作业上链系统”，而是一个面向可信证据的大数据智能管理系统。

它让用户可以自然地问：

```text
这份文件有没有被存证？
这批材料里哪些 proof 还缺失？
哪个版本和当前文件不一致？
帮我整理一份复核报告，并列出证明来源。
```

系统背后由 Chronofact、Chronestia、Limora、Noeryn 和未来的 Stratumind 分工协作：

- Chronofact 负责证据业务闭环
- Chronestia 负责可信存证与链上锚定
- Limora 负责组织身份与权限
- Noeryn 负责智能体过程治理
- Stratumind 负责证据检索与上下文组织

这套设计的重点是：让 AI 变成可信系统的操作助手，而不是让 AI 取代可信系统本身。证明仍然来自结构化记录和不可篡改锚点，AI 负责把复杂证据空间变得可查询、可解释、可管理。
