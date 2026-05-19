import { isChronofactError } from "../errors.js";
import { write } from "./io.js";

export function printVersionSummary(outputStream, title, result) {
  const version = result.asset_version;
  write(outputStream, `${title}: ${version.asset_id} ${version.version_id} v${version.version_no}\n`);
  write(outputStream, `sha256=${version.sha256}\n`);
  write(outputStream, `witness=${version.fact_id ?? "none"} receipt=${version.receipt_id ?? "none"}\n`);
  printVerificationSummary(outputStream, result);
}

export function printVerificationSummary(outputStream, result) {
  const verification = result.verification_result;
  write(
    outputStream,
    `verification=${verification.status} digest_match=${verification.digest_match} reason=${verification.failure_reason ?? "none"}\n`,
  );
  const explanation = result.ai_explanation?.summary ?? result.ai_explanation_error?.message;
  if (explanation) {
    write(outputStream, `ai=${explanation}\n`);
  }
}

export function printError(outputStream, error) {
  if (isChronofactError(error)) {
    write(outputStream, `Error ${error.code}: ${error.message}\n`);
    return;
  }
  write(outputStream, `Error: ${error.message}\n`);
}

export function printJson(outputStream, value) {
  write(outputStream, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeMenu(outputStream, state) {
  write(outputStream, "\n");
  write(outputStream, "1) Submit new asset\n");
  write(outputStream, "2) Add asset version\n");
  write(outputStream, "3) Verify asset/version\n");
  write(outputStream, "4) Show asset timeline\n");
  write(outputStream, "5) Show mock contract\n");
  write(outputStream, "6) Show last result JSON\n");
  write(outputStream, "0) Exit\n");
  write(outputStream, `Current asset=${state.lastAssetId ?? "-"} version=${state.lastVersionId ?? "-"}\n`);
}
