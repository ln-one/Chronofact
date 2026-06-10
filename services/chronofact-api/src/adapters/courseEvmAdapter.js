import { Contract, JsonRpcProvider, Wallet, ZeroHash } from "ethers";
import { ChronofactError } from "../errors.js";

const REGISTRY_ABI = [
  "function registerVersion(bytes32 digest,uint64 versionNo,bytes32 previousVersion) returns (bytes32 recordId)",
  "function computeRecordId(bytes32 digest,uint64 versionNo,address submitter,bytes32 previousVersion) view returns (bytes32 recordId)",
  "function verifyDigest(bytes32 recordId,bytes32 digest) view returns (bool)",
  "function getRecord(bytes32 recordId) view returns (tuple(bytes32 digest,uint64 versionNo,address submitter,bytes32 previousVersion,uint256 timestamp))",
  "event FileVersionRegistered(bytes32 indexed recordId,bytes32 indexed digest,uint64 versionNo,address indexed submitter,bytes32 previousVersion,uint256 timestamp)"
];

export function createCourseEvmAdapter({
  rpcUrl,
  contractAddress,
  privateKey,
  provider = null
}) {
  if (!rpcUrl) {
    throw new Error("rpcUrl is required for the course EVM adapter");
  }

  return {
    async registerVersion({ assetVersion, previousFactId, scenario }) {
      if (scenario === "chain_unavailable") {
        throw chainUnavailableError("Course EVM adapter is intentionally unavailable for this scenario.");
      }
      if (!contractAddress) {
        throw contractUnavailableError();
      }

      try {
        const { contract, signer, network } = await connect({ rpcUrl, contractAddress, privateKey, provider });
        const previousVersion = bytes32OrZero(previousFactId);
        const tx = await contract.registerVersion(`0x${assetVersion.sha256}`, assetVersion.version_no, previousVersion);
        const receipt = await tx.wait();
        const event = parseRegisterEvent(contract, receipt);
        const submitter = event?.submitter ?? await signer.getAddress();
        const recordId = event?.recordId ?? await computeRecordIdSafely({
          contract,
          digest: `0x${assetVersion.sha256}`,
          versionNo: assetVersion.version_no,
          submitter,
          previousVersion
        });
        const chain = {
          provider: "ganache",
          chain_id: network.chainId.toString(),
          contract_address: contractAddress,
          transaction_hash: receipt.hash,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed?.toString() ?? null,
          transaction_status: receipt.status === 1 ? "success" : "failed",
          event_name: "FileVersionRegistered",
          record_id: recordId,
          digest: event?.digest ?? `0x${assetVersion.sha256}`,
          version_no: Number(event?.versionNo ?? assetVersion.version_no),
          submitter,
          previous_version: event?.previousVersion ?? previousVersion,
          timestamp: event?.timestamp?.toString?.() ?? null,
          anchor_status: receipt.status === 1 ? "confirmed" : "failed"
        };

        if (receipt.status !== 1) {
          throw transactionFailedError(chain);
        }

        return {
          fact_id: recordId,
          receipt_id: receipt.hash,
          anchor_status: "confirmed",
          tx_hash: receipt.hash,
          recorded_at: new Date().toISOString(),
          previous_fact_id: previousFactId ?? null,
          fact_digest: assetVersion.sha256,
          provider: "ganache",
          chain,
          provider_payload: chain
        };
      } catch (error) {
        if (error instanceof ChronofactError) throw error;
        throw chainUnavailableError(`Course EVM chain is unavailable: ${error.message}`);
      }
    },

    async verifyVersion({ assetVersion, scenario }) {
      if (scenario === "chain_unavailable") {
        return chainUnavailableResult();
      }
      if (!contractAddress) {
        return contractUnavailableResult();
      }
      if (!assetVersion.fact_id) {
        return proofMissingResult();
      }

      try {
        const { contract } = await connect({ rpcUrl, contractAddress, privateKey, provider });
        const digestMatches = await contract.verifyDigest(assetVersion.fact_id, `0x${assetVersion.sha256}`);
        return {
          status: digestMatches ? "verified" : "failed",
          digest_match: Boolean(digestMatches),
          receipt_status: digestMatches ? "available" : "invalid",
          trace_status: "available",
          failure_reason: digestMatches ? null : "digest_mismatch"
        };
      } catch (error) {
        if (isRecordMissing(error)) {
          return proofMissingResult();
        }
        return chainUnavailableResult();
      }
    }
  };
}

async function connect({ rpcUrl, contractAddress, privateKey, provider }) {
  const rpcProvider = provider ?? new JsonRpcProvider(rpcUrl);
  const network = await rpcProvider.getNetwork();
  const signer = privateKey
    ? new Wallet(privateKey, rpcProvider)
    : await rpcProvider.getSigner(0);
  return {
    network,
    signer,
    contract: new Contract(contractAddress, REGISTRY_ABI, signer)
  };
}

function parseRegisterEvent(contract, receipt) {
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name !== "FileVersionRegistered") continue;
      return {
        recordId: parsed.args.recordId,
        digest: parsed.args.digest,
        versionNo: parsed.args.versionNo,
        submitter: parsed.args.submitter,
        previousVersion: parsed.args.previousVersion,
        timestamp: parsed.args.timestamp
      };
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return null;
}

async function computeRecordIdSafely({ contract, digest, versionNo, submitter, previousVersion }) {
  try {
    return await contract.computeRecordId(digest, versionNo, submitter, previousVersion);
  } catch {
    return null;
  }
}

function bytes32OrZero(value) {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value;
  }
  return ZeroHash;
}

function isRecordMissing(error) {
  return String(error?.message ?? "").includes("RecordNotFound");
}

function chainUnavailableError(message) {
  return new ChronofactError("chain_unavailable", message, 503);
}

function contractUnavailableError() {
  return new ChronofactError(
    "contract_unavailable",
    "ChronofactRegistry contract address is not configured.",
    503
  );
}

function transactionFailedError(chain) {
  const error = new ChronofactError(
    "transaction_failed",
    "Course EVM registerVersion transaction failed.",
    502
  );
  error.chain = chain;
  return error;
}

function proofMissingResult() {
  return {
    status: "pending",
    digest_match: true,
    receipt_status: "missing",
    trace_status: "missing",
    failure_reason: "proof_missing"
  };
}

function chainUnavailableResult() {
  return {
    status: "unsupported",
    digest_match: true,
    receipt_status: "unknown",
    trace_status: "unknown",
    failure_reason: "chain_unavailable"
  };
}

function contractUnavailableResult() {
  return {
    status: "unsupported",
    digest_match: true,
    receipt_status: "unknown",
    trace_status: "unknown",
    failure_reason: "contract_unavailable"
  };
}
