"""Rule-based AI explanation layer for Chronofact MVP.

This module intentionally does not generate or modify proof data. It only
translates structured evidence into human-readable explanation fields.
"""

from __future__ import annotations

from typing import Any


OUTPUT_KEYS = (
    "summary",
    "risks",
    "next_checks",
    "confidence_note",
    "evidence_basis",
)

ALLOWED_OUTPUT_KEYS = set(OUTPUT_KEYS)

CONFIDENCE_NOTE = (
    "AI 解释不构成真实性证明，证明来源为结构化回执、trace、"
    "verification result 与链上或存证系统返回的记录。"
)


def explain_evidence(evidence: dict[str, Any]) -> dict[str, Any]:
    """Return a fixed Chronofact AI explanation response.

    The input is expected to contain structured evidence from Chronofact,
    Chronestia, Dualweave, or mock equivalents.
    """

    verification = evidence.get("verification_result") or evidence.get("verification") or {}
    asset_version = evidence.get("asset_version") or evidence.get("asset_metadata") or {}
    receipt = evidence.get("receipt") or evidence.get("registration") or {}
    trace = evidence.get("trace") or {}
    version_history = evidence.get("version_history") or []

    status = str(verification.get("status") or "unknown").lower()
    digest_match = verification.get("digest_match")
    receipt_status = str(verification.get("receipt_status") or "").lower()
    trace_status = str(verification.get("trace_status") or "").lower()
    failure_reason = str(verification.get("failure_reason") or "").lower()

    context = _context(asset_version, receipt, trace, version_history)
    evidence_basis = _evidence_basis(asset_version, receipt, trace, verification, version_history)

    if digest_match is False or "digest mismatch" in failure_reason:
        response = _digest_mismatch(context, evidence_basis)
    elif "chain unavailable" in failure_reason or status == "unsupported" or trace_status in {
        "unavailable",
        "unsupported",
    }:
        response = _chain_unavailable(context, evidence_basis)
    elif "proof missing" in failure_reason or receipt_status in {"missing", "pending"} or status == "pending":
        response = _proof_missing(context, evidence_basis)
    elif status == "verified" and digest_match is True:
        response = _verified(context, evidence_basis)
    else:
        response = _unknown(context, evidence_basis)

    if len(version_history) > 1 or asset_version.get("previous_version_id"):
        response["summary"] += " 该资产存在版本关系，需结合 previous_version_id 和版本时间线查看上下文。"
        response["next_checks"].append("核对当前版本与上一版本的 previous link 是否符合预期。")
        if "version_history" not in response["evidence_basis"]:
            response["evidence_basis"].append("version_history")

    return _stable_response(response)


def _context(
    asset_version: dict[str, Any],
    receipt: dict[str, Any],
    trace: dict[str, Any],
    version_history: list[Any],
) -> dict[str, str]:
    version_no = asset_version.get("version_no", "unknown")
    asset_id = asset_version.get("asset_id", "unknown asset")
    sha256 = asset_version.get("sha256", "unknown digest")
    receipt_id = receipt.get("receipt_id") or receipt.get("id") or "missing receipt"
    trace_id = trace.get("trace_id") or trace.get("id") or "missing trace"
    version_count = str(len(version_history))
    return {
        "asset_id": str(asset_id),
        "version_no": str(version_no),
        "sha256": str(sha256),
        "receipt_id": str(receipt_id),
        "trace_id": str(trace_id),
        "version_count": version_count,
    }


def _evidence_basis(
    asset_version: dict[str, Any],
    receipt: dict[str, Any],
    trace: dict[str, Any],
    verification: dict[str, Any],
    version_history: list[Any],
) -> list[str]:
    basis: list[str] = []
    if asset_version.get("sha256"):
        basis.append("sha256")
    if receipt:
        basis.append("receipt")
    if trace:
        basis.append("trace")
    if verification:
        basis.append("verification_result")
    if version_history:
        basis.append("version_history")
    return basis


def _verified(context: dict[str, str], evidence_basis: list[str]) -> dict[str, Any]:
    return {
        "summary": (
            f"资产 {context['asset_id']} 的第 {context['version_no']} 版已有结构化登记记录，"
            f"当前 sha256 摘要 {context['sha256']} 与验证结果一致。"
        ),
        "risks": [],
        "next_checks": ["人工复核文件内容是否符合提交要求。"],
        "confidence_note": CONFIDENCE_NOTE,
        "evidence_basis": evidence_basis,
    }


def _digest_mismatch(context: dict[str, str], evidence_basis: list[str]) -> dict[str, Any]:
    return {
        "summary": (
            f"资产 {context['asset_id']} 的当前文件摘要与登记记录不一致，"
            "不能按已验证状态展示。"
        ),
        "risks": [
            "检测到 digest mismatch，文件可能被替换、损坏或选择了错误版本。",
            "在完成重新上传或人工核验前，不应把该结果解释为验证成功。",
        ],
        "next_checks": [
            "重新计算本地文件 sha256，并与登记记录逐项比对。",
            "检查用户是否上传了错误版本，必要时重新提交并生成新的登记记录。",
        ],
        "confidence_note": CONFIDENCE_NOTE,
        "evidence_basis": evidence_basis,
    }


def _proof_missing(context: dict[str, str], evidence_basis: list[str]) -> dict[str, Any]:
    return {
        "summary": (
            f"资产 {context['asset_id']} 的验证仍处于待确认状态，"
            "当前结构化证据中缺少可用 proof 或 receipt。"
        ),
        "risks": [
            "缺少 proof/receipt 时，无法完成完整验证链路。",
            "该状态只能说明证据不足，不能说明文件已经验证成功或失败。",
        ],
        "next_checks": [
            "等待 Chronestia 或链上存证系统返回 receipt。",
            "检查后端任务队列、交易 hash 或 trace 是否仍在处理中。",
        ],
        "confidence_note": CONFIDENCE_NOTE,
        "evidence_basis": evidence_basis,
    }


def _chain_unavailable(context: dict[str, str], evidence_basis: list[str]) -> dict[str, Any]:
    return {
        "summary": (
            f"资产 {context['asset_id']} 暂时无法完成链路验证，"
            "原因是链上或存证 trace 不可达。"
        ),
        "risks": [
            "chain unavailable 会导致验证状态无法及时确认。",
            "该状态不等于文件无效，也不等于验证成功。",
        ],
        "next_checks": [
            "检查 Ganache、Remix、Chronestia 或区块链节点连接状态。",
            "保留当前结构化记录，待链路恢复后重新查询 trace 和 receipt。",
        ],
        "confidence_note": CONFIDENCE_NOTE,
        "evidence_basis": evidence_basis,
    }


def _unknown(context: dict[str, str], evidence_basis: list[str]) -> dict[str, Any]:
    return {
        "summary": (
            f"资产 {context['asset_id']} 的验证状态无法由当前结构化证据明确解释。"
        ),
        "risks": ["输入证据不完整或状态值不在当前 MVP 支持范围内。"],
        "next_checks": [
            "检查 verification_result.status、digest_match、receipt_status 和 trace_status。",
            "补齐 receipt、trace 或 failure_reason 后重新请求解释。",
        ],
        "confidence_note": CONFIDENCE_NOTE,
        "evidence_basis": evidence_basis,
    }


def _stable_response(response: dict[str, Any]) -> dict[str, Any]:
    result = {key: response[key] for key in OUTPUT_KEYS}
    result["risks"] = list(dict.fromkeys(result["risks"]))
    result["next_checks"] = list(dict.fromkeys(result["next_checks"]))
    result["evidence_basis"] = list(dict.fromkeys(result["evidence_basis"]))
    return result
