# Chronofact Course Chain Walkthrough

This document is owned by group member C. It covers the blockchain course path:
minimal Solidity contract, Ganache deployment, Remix operation, MetaMask/Faucet
walkthrough, and transaction/event/receipt inspection.

## Scope

The contract records only:

- `digest`
- `version_no`
- `submitter`
- `previous_version`
- `timestamp`

It must not put original files, sensitive business data, or large metadata blobs
on-chain.

## Local Ganache Demo

Prerequisites:

- Node.js 20+
- npm
- Ganache running locally
- RPC URL, usually `http://127.0.0.1:7545` for Ganache UI or
  `http://127.0.0.1:8545` for Ganache CLI

Create local chain config:

```powershell
Copy-Item configs\chain.env.example configs\chain.env
```

Edit `configs\chain.env` if your Ganache RPC port is not `7545`.

Install dependencies:

```powershell
npm install
```

Start a local Ganache chain in a separate terminal:

```powershell
npm run chain:ganache
```

Compile the contract:

```powershell
npm run contracts:compile
```

Deploy to Ganache:

```powershell
npm run contracts:deploy:ganache
```

Register a sample file version:

```powershell
npm run contracts:sample
```

Register a two-version chain demo:

```powershell
npm run contracts:sample:versions
```

The two-version demo prints a JSON object with `v1` and `v2` transaction
hashes, receipt blocks, event fields, and a check that `v2.previous_version`
points to the `v1.record_id`.

Expected output includes:

- deploy transaction hash
- deployed contract address
- receipt block number
- gas used
- register transaction hash
- `FileVersionRegistered` event with `recordId`, `digest`, `versionNo`,
  `submitter`, `previousVersion`, and `timestamp`

## Remix Demo

1. Open Remix IDE.
2. Create `ChronofactRegistry.sol`.
3. Copy the contents of `contracts/ChronofactRegistry.sol`.
4. Compile with Solidity `0.8.24` or newer compatible `0.8.x`.
5. Choose one environment:
   - `Remix VM` for the fastest offline demo.
   - `Injected Provider - MetaMask` for MetaMask-connected local/test network.
6. Deploy `ChronofactRegistry`.
7. Call `registerVersion` with:
   - `digest`: a SHA-256 bytes32 value, for example
     `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
   - `versionNo`: `1`
   - `previousVersion`:
     `0x0000000000000000000000000000000000000000000000000000000000000000`
8. Inspect the transaction receipt and event logs in Remix.
9. Copy `recordId` from `FileVersionRegistered`.
10. Call `verifyDigest(recordId, digest)` and confirm it returns `true`.

For a multi-version demo, register version 2 with a new digest and set
`previousVersion` to the version 1 `recordId`.

## MetaMask And Faucet Walkthrough

For Ganache:

1. Start Ganache and note the RPC URL, chain ID, and funded account list.
2. Add a MetaMask custom network:
   - Network name: `Ganache Local`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: the Ganache chain ID
   - Currency symbol: `ETH`
3. Import a Ganache local-only private key into MetaMask.
4. Use Remix `Injected Provider - MetaMask`.
5. Deploy and register a file version.
6. Confirm MetaMask prompts show only contract deployment or method calls, never
   original files or sensitive business content.

For public test networks:

1. Add the selected Ethereum test network in MetaMask.
2. Use a faucet to fund the test wallet.
3. Keep the funded account test-only.
4. Use Remix `Injected Provider - MetaMask`.
5. Deploy the contract and record the deployment transaction hash.

Never commit private keys, mnemonics, or personal wallet secrets.

## Receipt And Event Evidence

For the course demo, capture these evidence fields:

- Contract address
- Deployment transaction hash
- Register transaction hash
- Receipt status
- Receipt block number
- Gas used
- `FileVersionRegistered.recordId`
- `FileVersionRegistered.digest`
- `FileVersionRegistered.versionNo`
- `FileVersionRegistered.submitter`
- `FileVersionRegistered.previousVersion`
- `FileVersionRegistered.timestamp`

These fields are evidence surfaces for Chronofact and the AI explanation layer.
The AI explanation layer may summarize them, but it is not the proof source.

## Connect The Course Chain To Chronofact API

The main Chronofact app can run in three witness modes:

- default mock witness adapter
- Chronestia HTTP adapter through `CHRONOFACT_CHRONESTIA_URL`
- course EVM adapter through Ganache and `ChronofactRegistry`

To use the course Solidity contract in the current product flow:

1. Start Ganache.
2. Deploy `ChronofactRegistry`.
3. Copy the deployed contract address from
   `deployments/ganache/ChronofactRegistry.json`.
4. Start `services/chronofact-api` with:

```powershell
$env:CHRONOFACT_COURSE_EVM_URL="http://127.0.0.1:7545"
$env:CHRONOFACT_REGISTRY_ADDRESS="<deployed contract address>"
$env:CHRONOFACT_AI_URL="http://127.0.0.1:8000"
npm --prefix services/chronofact-api start
```

When this adapter is enabled, a user preserve action follows this path:

```text
frontend upload
-> chronofact-agent
-> chronofact-api
-> ChronofactRegistry.registerVersion
-> transaction receipt + FileVersionRegistered event
-> frontend chain record card
-> AI evidence_basis
```

The API returns a normalized `chain` object:

```json
{
  "provider": "ganache",
  "chain_id": "1337",
  "contract_address": "0x...",
  "transaction_hash": "0x...",
  "block_number": 12,
  "gas_used": "123456",
  "transaction_status": "success",
  "event_name": "FileVersionRegistered",
  "record_id": "0x...",
  "digest": "0x...",
  "version_no": 2,
  "submitter": "0x...",
  "previous_version": "0x...",
  "timestamp": "1710000000"
}
```

Frontend displays this data in the chain record panel. The AI explanation layer
may cite `transaction_hash`, `contract_event`, `block_number`, and `record_id`
inside `evidence_basis`, but it must still state that proof comes from
structured records and chain output, not from AI.

## Failure States

The course chain path must not silently convert infrastructure failure into a
successful notarization.

- Ganache not running: `chain_unavailable`
- `CHRONOFACT_REGISTRY_ADDRESS` missing: `contract_unavailable`
- reverted or failed transaction: `transaction_failed`
- missing receipt or record: `proof_missing`
- digest comparison failure: `digest_mismatch`

For demo recovery:

1. Check Ganache is listening on `CHAIN_RPC_URL`.
2. Check `CHRONOFACT_REGISTRY_ADDRESS` matches the latest deployment.
3. Re-run `npm run contracts:deploy:ganache` if Ganache was restarted.
4. Restart `services/chronofact-api` so it reads the updated environment.
