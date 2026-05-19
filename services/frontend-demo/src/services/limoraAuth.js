export const limoraApiBaseUrl =
  (import.meta.env.VITE_LIMORA_API_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");

async function requestLimora(path, options = {}) {
  let response;
  try {
    response = await fetch(`${limoraApiBaseUrl}${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new Error("身份服务暂时不可用，请稍后重试或联系系统管理员。");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(toFriendlyAuthError(payload, response.status));
    error.code = payload.error?.code || payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function registerIdentity({ displayName, email, password, confirmPassword }) {
  if (!displayName || !email || !password) {
    throw new Error("请填写姓名、邮箱和密码。");
  }
  if (password !== confirmPassword) {
    throw new Error("两次输入的密码不一致。");
  }
  if (password.length < 8) {
    throw new Error("密码至少需要 8 位。");
  }
  return requestLimora("/v1/auth/register", {
    method: "POST",
    body: {
      name: displayName,
      email,
      password,
    },
  });
}

export function loginIdentity({ email, password }) {
  if (!email || !password) {
    throw new Error("请输入邮箱和密码。");
  }
  return requestLimora("/v1/auth/login", {
    method: "POST",
    body: {
      email,
      password,
    },
  });
}

export function logoutIdentity() {
  return requestLimora("/v1/auth/logout", { method: "POST" });
}

export function getCurrentSession() {
  return requestLimora("/v1/sessions/current");
}

export function toDisplayUser(sessionPayload) {
  const data = sessionPayload?.data ?? sessionPayload;
  const user = data?.user ?? data?.identity ?? {};
  const session = data?.session ?? {};
  const memberships = data?.memberships ?? [];
  const primaryMembership = memberships[0];

  return {
    id: user.id || session.userId || "unknown",
    displayName: user.name || user.displayName || user.email || "已登录用户",
    email: user.email || "",
    organization: primaryMembership?.organization?.name || primaryMembership?.organizationName || primaryMembership?.organizationId || "暂未分配课程",
    role: primaryMembership ? "成员" : "普通用户",
    sessionId: session.id || "",
    memberships,
  };
}

function toFriendlyAuthError(payload, status) {
  const message = payload.error?.message || payload.message || "";
  if (status === 401) {
    return "邮箱或密码不正确，请检查后重试。";
  }
  if (status === 409) {
    return "该邮箱已经注册，请直接登录。";
  }
  if (status === 400 && /password/i.test(message)) {
    return "密码格式不符合要求，请至少输入 8 位。";
  }
  return message || "身份服务暂时无法完成请求，请稍后重试。";
}
