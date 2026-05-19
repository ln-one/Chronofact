export function createTuiState() {
  return {
    lastAssetId: null,
    lastVersionId: null,
    lastResult: null,
  };
}

export function rememberResult(state, result) {
  const version = result.asset_version;
  if (version) {
    state.lastAssetId = version.asset_id;
    state.lastVersionId = version.version_id;
  }
  state.lastResult = result;
}
