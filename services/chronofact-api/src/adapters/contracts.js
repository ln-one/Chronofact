const ADAPTER_CONTRACTS = {
  limora: ["resolveIdentity"],
  dualweave: ["storeUpload"],
  chronestia: ["registerVersion", "verifyVersion"],
  ai: ["explain"]
};

export function assertAdapterContract(name, adapter) {
  const methods = ADAPTER_CONTRACTS[name];
  if (!methods) {
    throw new Error(`Unknown Chronofact adapter contract: ${name}`);
  }

  if (!adapter || typeof adapter !== "object") {
    throw new Error(`Chronofact ${name} adapter must be an object.`);
  }

  for (const method of methods) {
    if (typeof adapter[method] !== "function") {
      throw new Error(`Chronofact ${name} adapter must implement ${method}().`);
    }
  }

  return adapter;
}

export function assertChronofactAdapters(clients) {
  for (const name of Object.keys(ADAPTER_CONTRACTS)) {
    assertAdapterContract(name, clients?.[name]);
  }
  return clients;
}

