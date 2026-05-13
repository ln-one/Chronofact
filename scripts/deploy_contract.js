require("dotenv").config({ path: "configs/chain.env" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ContractFactory, JsonRpcProvider, Wallet } = require("ethers");
const { compileContract } = require("./compile_contract");

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

async function main() {
  const { artifact } = compileContract();
  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const signer = await resolveSigner(provider);
  const deployer = await signer.getAddress();
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Network chainId: ${network.chainId.toString()}`);
  console.log(`Deployer: ${deployer}`);

  const contract = await factory.deploy();
  console.log(`Deploy tx hash: ${contract.deploymentTransaction().hash}`);

  await contract.waitForDeployment();
  const receipt = await contract.deploymentTransaction().wait();
  const address = await contract.getAddress();

  const deployment = {
    contractName: "ChronofactRegistry",
    address,
    chainId: network.chainId.toString(),
    rpcUrl,
    deployer,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    abi: artifact.abi,
  };

  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log(`Contract address: ${address}`);
  console.log(`Receipt block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`Saved deployment: ${path.relative(root, deploymentPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
