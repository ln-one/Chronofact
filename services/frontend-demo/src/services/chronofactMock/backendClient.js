export const apiBaseUrl = import.meta.env.VITE_CHRONOFACT_API_URL?.replace(/\/+$/, "");

export function isLiveApiEnabled() {
  return Boolean(apiBaseUrl);
}

export async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed with ${response.status}`);
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

export async function fileToText(file) {
  if (!file) {
    return "chronofact demo content";
  }
  return file.text();
}
