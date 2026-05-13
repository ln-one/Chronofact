# Chronofact 前端系统

这是组员 B 在实验 8 阶段维护的前端页面，用于展示课程实验资产的上传、固化、核验、版本追溯与 AI 辅助解释。

当前实现已迁移到：

- React
- Vite
- Tailwind CSS
- 本地 shadcn/ui 风格组件

## 页面内容

页面按系统视图组织，顶部导航可在四个页面之间切换：

- 实验项目：文件选择、摘要计算、固化提交、回执等待和流程状态
- 资产库：资产基础信息、SHA-256 摘要、版本与 previous link 时间线
- 核验中心：可信证据链固化回执、验证状态、AI summary、risks 和 next checks
- 报告导出：核验摘要、人工复核建议和 AI 边界声明

## 统一 Mock Contract

页面数据以团队统一 Mock Contract 为基础，保留以下顶层对象：

- `identity_context`
- `upload_record`
- `asset_version`
- `verification_result`
- `ai_explanation`

前端为了展示课程验收需要，额外扩展了：

- `proof`：展示 receipt、trace、transaction hash 和 timestamp
- `timeline`：展示 `v1 -> v2`、digest 和 `previous_version_id`

这些扩展只用于 UI 演示，不改变统一 Mock Contract 的基础结构。

## 验收场景

当前页面可在右上角切换以下 mock 场景：

- 正常提交：`verified`，digest 匹配，receipt 和 trace 可用
- 文件被篡改：`failed`，`failure_reason=digest_mismatch`
- 缺少 proof：`pending`，`failure_reason=proof_missing`
- 链不可达：`unsupported`，`failure_reason=chain_unavailable`
- 多版本追踪：展示 `v1 -> v2` 和 `previous_version_id`
- 上传失败：`failed`，`failure_reason=upload_failed`
- AI 解释不可用：结构化证明可用，但 `failure_reason=ai_explanation_unavailable`

## 运行方式

首次运行：

```powershell
cd services/frontend-demo
npm install
npm run dev
```

然后访问 Vite 输出的本地地址。

## 数据说明

页面数据仍按团队统一 Mock Contract 分层：

- `identity_context`
- `upload_record`
- `asset_version`
- `verification_result`
- `ai_explanation`

这些字段用于前端展示和后续对接组员 A 的后端 API。
