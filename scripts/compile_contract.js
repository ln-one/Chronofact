const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.resolve(__dirname, "..");
const contractPath = path.join(root, "contracts", "ChronofactRegistry.sol");
const artifactDir = path.join(root, "deployments", "artifacts");
const artifactPath = path.join(artifactDir, "ChronofactRegistry.json");

function compileContract() {
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "ChronofactRegistry.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors || [];
  const fatalErrors = errors.filter((error) => error.severity === "error");
  for (const error of errors) {
    const stream = error.severity === "error" ? process.stderr : process.stdout;
    stream.write(`${error.formattedMessage}\n`);
  }
  if (fatalErrors.length > 0) {
    throw new Error("Solidity compilation failed");
  }

  const contract = output.contracts["ChronofactRegistry.sol"].ChronofactRegistry;
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        contractName: "ChronofactRegistry",
        sourceName: "ChronofactRegistry.sol",
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
      },
      null,
      2
    )
  );

  return {
    artifactPath,
    artifact: JSON.parse(fs.readFileSync(artifactPath, "utf8")),
  };
}

if (require.main === module) {
  const result = compileContract();
  console.log(`Compiled ChronofactRegistry -> ${path.relative(root, result.artifactPath)}`);
}

module.exports = { compileContract };
