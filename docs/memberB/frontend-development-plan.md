# Chronofact 组员 B 前端开发计划

## 1. 职责范围

组员 B 负责 Chronofact 课程演示中的前端页面与交互。

前端需要清晰展示：

- 文件上传
- 资产详情
- 版本时间线
- 回执状态
- 验证状态
- AI 解释区域
- 人工复核提示

组员 B 不负责：

- 后端业务编排
- Chronestia、Limora、Dualweave 的内部实现
- Solidity 合约实现
- AI 证明、AI 裁决或 AI 推理语义

在组员 A 提供稳定后端接口之前，前端可以先使用 mock JSON 或 mock API 响应完成演示。

## 2. 产品流程

UI 需要展示下面这条主流程：

```text
上传文件
-> 展示 digest 和存储状态
-> 创建资产版本
-> 展示 witness receipt 和 verification result
-> 展示版本时间线
-> 展示 AI 解释与人工复核建议
```

页面必须明确表达：

```text
AI 解释不是证明来源。
证明来源是结构化 receipt、trace、verification result 和 digest。
```

## 3. 必做页面

### 上传页面

目标：

- 允许用户选择教学文件
- 展示文件名、文件大小和上传状态
- 展示生成或 mock 的 SHA-256 digest
- mock 提交成功后进入资产详情视图

必须支持的状态：

- 未选择文件
- 上传中
- 上传成功
- 上传失败

### 资产详情页面

目标：

- 展示当前资产元数据
- 展示版本号和上一版本链接
- 展示 digest 和提交者引用
- 展示 receipt、trace 和验证状态
- 展示 AI 解释和人工复核建议

必须包含的区域：

- 资产摘要
- digest 与版本事实
- receipt / proof 面板
- 验证状态面板
- AI 解释面板
- 版本时间线

### 版本时间线

目标：

- 让 `v1 -> v2` 和 `previous_version_id` 可见
- 展示每个版本的 digest
- 展示每个版本的验证状态
- 让被篡改或待确认的版本在视觉上明显区分

必须准备的示例：

- `v1` 验证成功
- `v2` 验证成功，并能看到 previous link
- 至少一个失败或 digest mismatch 的演示版本

## 4. 状态模型

前端必须支持这些高层状态：

- `verified`
- `pending`
- `failed`
- `unsupported`

前端还必须区分这些失败或降级原因：

- `upload_failed`
- `digest_mismatch`
- `proof_missing`
- `chain_unavailable`
- `ai_explanation_unavailable`

建议展示映射：

| 状态 | 含义 | UI 表现 |
| --- | --- | --- |
| `verified` | digest 和 proof 一致 | 成功状态 |
| `pending` | proof 或 receipt 尚未就绪 | 等待状态 |
| `failed` | 验证失败 | 错误状态 |
| `unsupported` | 当前链或 proof 来源无法验证 | 中性警告 |
| `digest_mismatch` | 重新计算的 digest 与记录不一致 | 高风险警告 |
| `proof_missing` | 没有可用 receipt 或 proof | 缺少证明提示 |
| `chain_unavailable` | 链后端无法访问 | 基础设施异常提示 |
| `ai_explanation_unavailable` | 证据存在，但 AI 文案生成失败 | 非阻塞提示 |

## 5. Mock 数据契约

第一阶段前端开发建议使用一个统一 mock 对象：

```json
{
  "identity_context": {
    "user_id": "user_001",
    "display_name": "Student A",
    "organization_id": "course_001",
    "role": "student"
  },
  "upload_record": {
    "upload_id": "upl_001",
    "storage_ref": "dualweave://upl_001",
    "filename": "report.pdf",
    "sha256": "abc123",
    "status": "stored"
  },
  "asset_version": {
    "asset_id": "asset_001",
    "asset_type": "lab_report",
    "version_no": 1,
    "previous_version_id": null,
    "sha256": "abc123",
    "submitter_id": "user_001"
  },
  "verification_result": {
    "status": "verified",
    "digest_match": true,
    "receipt_status": "available",
    "trace_status": "available",
    "failure_reason": null
  },
  "ai_explanation": {
    "summary": "该文件版本已完成登记，当前 digest 与记录证据一致。",
    "risks": [],
    "next_checks": ["人工复核文件内容是否符合提交要求。"],
    "confidence_note": "AI 解释不是证明来源，证明来源是结构化 receipt 与 verification result。",
    "evidence_basis": ["sha256 digest", "receipt", "trace", "verification result"]
  }
}
```

课程演示页面可以使用中文文案，但字段名应保持英文，方便后续和后端 API 对接。

## 6. 演示场景

前端应支持在这些 mock 场景之间切换：

1. 正常提交
   - 文件已登记
   - digest 匹配
   - receipt 可用
   - AI 摘要可用

2. 文件被篡改
   - digest mismatch
   - verification failed
   - AI 只解释风险，不能声称自己完成证明

3. 缺少 proof
   - verification 为 pending 或 proof missing
   - UI 明确说明系统暂时无法确认 proof

4. 链不可达
   - verification 为 unsupported 或 chain unavailable
   - UI 区分基础设施异常和 digest mismatch

5. 多版本记录
   - 展示 `v1 -> v2`
   - previous version link 可见
   - 每个版本都有自己的 digest 和验证状态

## 7. 开发阶段

### 阶段一：静态 Mock UI

交付内容：

- 上传页面骨架
- 资产详情页面骨架
- 版本时间线组件
- 状态 badge / 状态面板组件
- 本地 mock 数据文件

目标：

- 不依赖后端也能演示全部主要页面

### 阶段二：交互演示

交付内容：

- 文件选择交互
- mock 上传状态流转
- 演示场景切换器
- 从上传视图进入资产详情视图

目标：

- 演示者可以快速展示五个必备场景

### 阶段三：API 适配边界

交付内容：

- 上传、资产详情、验证、AI 解释的前端 service 函数
- 使用相同函数名的 mock 实现
- 记录后端需要返回的字段

目标：

- 后续将 mock 响应替换为组员 A 的后端 API 时，尽量少改 UI

### 阶段四：打磨与验收

交付内容：

- 清晰的空状态、加载状态、成功状态、等待状态、失败状态和 unsupported 状态
- 面向课程展示的中文标签
- 明确的 AI 边界声明
- 简短的前端 README 或运行说明

目标：

- 组员 B 的前端可以独立运行、独立演示、独立验收

## 8. 验收清单

- [ ] 上传页面存在，并能展示 mock 成功和失败。
- [ ] 资产详情页展示 digest、version、submitter、receipt 和 verification。
- [ ] 版本时间线至少展示两个有关联的版本。
- [ ] UI 能区分 `verified`、`pending`、`failed` 和 `unsupported`。
- [ ] UI 能区分 `digest_mismatch`、`proof_missing` 和 `chain_unavailable`。
- [ ] AI 解释面板明确说明 AI 不是证明来源。
- [ ] 正常场景和风险场景都能看到人工复核提示。
- [ ] mock 数据可以驱动全部必备演示场景。
- [ ] 前端不需要等待真实后端服务也能运行或演示。

## 9. 协作说明

组员 B 需要和这些角色对齐：

- 组员 A：后端 endpoint 名称和响应结构
- 组员 C：transaction hash、event、receipt、chain unavailable 的展示数据
- 组员 D：AI explanation 输出字段和边界文案
- 核心 owner：最终 mock contract 和集成验收标准

组员 B 不应在 UI 代码中重新定义证明语义。前端只负责展示后端或 mock contract 提供的结构化证据和验证状态。

