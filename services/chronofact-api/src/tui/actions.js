import { askDefault, requireAnswer, write } from "./io.js";
import { askContent, askScenario, maybePrintJson } from "./prompts.js";
import { printVerificationSummary, printVersionSummary } from "./renderers.js";
import { rememberResult } from "./state.js";

export async function submitAsset({ prompt, orchestrator, state, outputStream }) {
  const filename = await requireAnswer(prompt, "Filename: ");
  const assetType = await askDefault(prompt, "Asset type", "lab_report");
  const content = await askContent(prompt);
  const scenario = await askScenario(prompt, outputStream);

  const result = await orchestrator.submit({
    filename,
    asset_type: assetType,
    content,
    scenario,
  });

  rememberResult(state, result);
  printVersionSummary(outputStream, "Created asset version", result);
  await maybePrintJson({ prompt, outputStream, result });
}

export async function addVersion({ prompt, orchestrator, state, outputStream }) {
  const assetId = await askDefault(prompt, "Asset ID", state.lastAssetId);
  const filename = await requireAnswer(prompt, "Filename: ");
  const assetType = await askDefault(prompt, "Asset type", "lab_report");
  const content = await askContent(prompt);
  const scenario = await askScenario(prompt, outputStream);

  const result = await orchestrator.createVersion({
    asset_id: assetId,
    filename,
    asset_type: assetType,
    content,
    scenario,
  });

  rememberResult(state, result);
  printVersionSummary(outputStream, "Created next version", result);
  await maybePrintJson({ prompt, outputStream, result });
}

export async function verifyVersion({ prompt, orchestrator, state, outputStream }) {
  const targetMode = await askDefault(prompt, "Verify by version or asset? [version/asset]", "version");
  const request =
    targetMode.toLowerCase().startsWith("a")
      ? { asset_id: await askDefault(prompt, "Asset ID", state.lastAssetId) }
      : { version_id: await askDefault(prompt, "Version ID", state.lastVersionId) };
  const hasContent = await askDefault(prompt, "Compare submitted content? [y/N]", "N");

  if (hasContent.toLowerCase().startsWith("y")) {
    request.content = await askContent(prompt);
  }

  request.scenario = await askScenario(prompt, outputStream);

  const result = await orchestrator.verify(request);
  rememberResult(state, result);
  printVerificationSummary(outputStream, result);
  await maybePrintJson({ prompt, outputStream, result });
}

export async function showAsset({ prompt, orchestrator, state, outputStream }) {
  const assetId = await askDefault(prompt, "Asset ID", state.lastAssetId);
  const result = orchestrator.describeAsset(assetId);
  state.lastAssetId = result.asset_id;
  state.lastVersionId = result.version_ids.at(-1) ?? state.lastVersionId;
  state.lastResult = result;

  write(outputStream, `Asset ${result.asset_id} (${result.asset_type})\n`);
  for (const version of result.versions) {
    write(
      outputStream,
      `- ${version.version_id} v${version.version_no} sha256=${version.sha256.slice(0, 12)}... previous=${version.previous_version_id ?? "none"}\n`,
    );
  }
  await maybePrintJson({ prompt, outputStream, result });
}
