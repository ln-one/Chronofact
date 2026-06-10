require("dotenv").config({ path: "configs/chain.env" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Contract, JsonRpcProvider, Wallet, ZeroHash, sha256, toUtf8Bytes } = require("ethers");

const root = path.resolve(__dirname, "..");
const rpcUrl = process.env.CHAIN_RPC_URL || "http://127.0.0.1:7545";
const deploymentPath = path.resolve(
  root,
  process.env.CHRONOFACT_REGISTRY_DEPLOYMENT || "deployments/ganache/ChronofactRegistry.json"
);

async function resolveSigner(provider) {
  if (process.env.CHAIN_PRIVATE_KEY) {
    return new Wallet(process.env.CHAIN_PRIVATE_KEY, provider);
  }
  return provider.getSigner(0);
}

function readDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function registerVersion({ contract, label, content, versionNo, previousVersion }) {
  const digest = sha256(toUtf8Bytes(content));
  const tx = await contract.registerVersion(digest, versionNo, previousVersion);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "FileVersionRegistered");
  if (!event) {
    throw new Error(`FileVersionRegistered event not found for ${label}`);
  }

  return {
    label,
    digest,
    transaction_hash: receipt.hash,
    receipt_status: receipt.status,
    block_number: receipt.blockNumber,
    gas_used: receipt.gasUsed.toString(),
    event_name: event.name,
    record_id: event.args.recordId,
    version_no: Number(event.args.versionNo),
    submitter: event.args.submitter,
    previous_version: event.args.previousVersion,
    timestamp: event.args.timestamp.toString()
  };
}

async function main() {
  const deployment = readDeployment();
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = await resolveSigner(provider);
  const network = await provider.getNetwork();
  const contract = new Contract(deployment.address, deployment.abi, signer);

  const v1 = await registerVersion({
    contract,
    label: "v1",
    content: "chronofact course chain demo report v1",
    versionNo: 1,
    previousVersion: ZeroHash
  });
  const v2 = await registerVersion({
    contract,
    label: "v2",
    content: "chronofact course chain demo report v2",
    versionNo: 2,
    previousVersion: v1.record_id
  });
  const v2Verified = await contract.verifyDigest(v2.record_id, v2.digest);

  console.log(JSON.stringify({
    chain_id: network.chainId.toString(),
    rpc_url: rpcUrl,
    contract_address: deployment.address,
    versions: [v1, v2],
    checks: {
      v2_previous_points_to_v1: v2.previous_version === v1.record_id,
      v2_digest_verified: Boolean(v2Verified)
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
