# Chronofact AI Explanation MVP

这是组员 D 的 AI 解释层 MVP。它只把结构化证据转化为 `summary`、`risks`、`next_checks`、`confidence_note` 和 `evidence_basis`，不生成或修改 digest、receipt、proof，也不裁决真实性或责任。

## 运行命令

命令行解释 mock 数据：

```powershell
python explain.py mock/verified.json
python explain.py mock/digest-mismatch.json
python explain.py mock/proof-missing.json
python explain.py mock/chain-unavailable.json
python explain.py mock/multi-version.json
```

启动 HTTP API：

```powershell
python run_server.py
```

健康检查：

```powershell
curl http://127.0.0.1:8000/health
```

解释接口：

```powershell
curl -X POST http://127.0.0.1:8000/api/ai/explain -H "Content-Type: application/json" --data-binary "@mock/verified.json"
```

运行测试：

```powershell
python -m unittest discover -s tests
```

## API Contract

`POST /api/ai/explain`

输入只允许来自结构化证据，例如：

- `fact`
- `registration`
- `receipt`
- `trace`
- `verification` 或 `verification_result`
- `asset_metadata` 或 `asset_version`
- `version_history`

固定输出：

```json
{
  "summary": "string",
  "risks": [],
  "next_checks": [],
  "confidence_note": "string",
  "evidence_basis": []
}
```

## MVP 支持场景

- 正常提交：`verified`
- 文件篡改或错误版本：`digest mismatch`
- 缺少 proof：`proof missing`
- 链不可达：`chain unavailable`
- 多版本关系：`v1 -> v2`

## AI 边界声明

AI 解释层只负责把结构化证据转化为便于理解的说明、摘要、风险提示和下一步人工复核建议。

AI 不负责证明真实性，不负责生成证明，不负责裁决责任，也不能把失败、缺失或待确认状态改写成成功状态。

最终证明来源是：

- `sha256 digest`
- `receipt`
- `trace`
- `verification result`
- 链上或存证系统返回的结构化记录
