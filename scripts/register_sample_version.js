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

async function main() {
  const deployment = readDeployment();
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = await resolveSigner(provider);
  const contract = new Contract(deployment.address, deployment.abi, signer);

  const digest = sha256(toUtf8Bytes("chronofact sample report v1"));
  const versionNo = 1;
  const previousVersion = ZeroHash;

  const tx = await contract.registerVersion(digest, versionNo, previousVersion);
  console.log(`Register tx hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Receipt status: ${receipt.status}`);
  console.log(`Receipt block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  for (const log of receipt.logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed && parsed.name === "FileVersionRegistered") {
      console.log("Event: FileVersionRegistered");
      console.log(`  recordId: ${parsed.args.recordId}`);
      console.log(`  digest: ${parsed.args.digest}`);
      console.log(`  versionNo: ${parsed.args.versionNo.toString()}`);
      console.log(`  submitter: ${parsed.args.submitter}`);
      console.log(`  previousVersion: ${parsed.args.previousVersion}`);
      console.log(`  timestamp: ${parsed.args.timestamp.toString()}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
