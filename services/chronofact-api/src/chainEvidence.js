export function normalizeChainEvidence({ witnessRecord = {}, verificationResult = {} } = {}) {
  const payload = witnessRecord.provider_payload ?? {};
  const chain = witnessRecord.chain ?? payload.chain ?? {};
  const event = witnessRecord.event ?? payload.event ?? {};
  const receipt = witnessRecord.receipt ?? payload.receipt ?? {};

  const transactionHash =
    witnessRecord.transaction_hash ??
    witnessRecord.tx_hash ??
    payload.transaction_hash ??
    payload.tx_hash ??
    receipt.transaction_hash ??
    null;
  const contractAddress =
    witnessRecord.contract_address ??
    payload.contract_address ??
    chain.contract_address ??
    receipt.contract_address ??
    null;
  const blockNumber =
    witnessRecord.block_number ??
    payload.block_number ??
    receipt.block_number ??
    null;
  const recordId =
    witnessRecord.record_id ??
    payload.record_id ??
    event.record_id ??
    witnessRecord.fact_id ??
    null;

  return {
    provider: witnessRecord.provider ?? payload.provider ?? "chronestia",
    chain_id: stringOrNull(witnessRecord.chain_id ?? payload.chain_id ?? chain.chain_id),
    contract_address: contractAddress,
    transaction_hash: transactionHash,
    block_number: numberOrStringOrNull(blockNumber),
    gas_used: stringOrNull(witnessRecord.gas_used ?? payload.gas_used ?? receipt.gas_used),
    transaction_status: stringOrNull(
      witnessRecord.transaction_status ?? payload.transaction_status ?? receipt.status
    ),
    event_name: stringOrNull(witnessRecord.event_name ?? payload.event_name ?? event.name),
    record_id: recordId,
    digest: stringOrNull(witnessRecord.digest ?? payload.digest ?? event.digest),
    version_no: numberOrStringOrNull(witnessRecord.version_no ?? payload.version_no ?? event.version_no),
    submitter: stringOrNull(witnessRecord.submitter ?? payload.submitter ?? event.submitter),
    previous_version: stringOrNull(
      witnessRecord.previous_version ?? payload.previous_version ?? event.previous_version
    ),
    timestamp: numberOrStringOrNull(witnessRecord.timestamp ?? payload.timestamp ?? event.timestamp),
    anchor_status: witnessRecord.anchor_status ?? null,
    receipt_status: verificationResult.receipt_status ?? null,
    verification_status: verificationResult.status ?? null,
    failure_reason: verificationResult.failure_reason ?? null
  };
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function numberOrStringOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "bigint" ? value.toString() : value;
}
