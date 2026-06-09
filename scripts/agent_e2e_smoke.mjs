const origin = process.env.CHRONOFACT_E2E_ORIGIN ?? "http://127.0.0.1:5176";
const limoraBaseUrl = stripTrailingSlash(process.env.LIMORA_API_URL ?? "http://127.0.0.1:3002");
const agentBaseUrl = stripTrailingSlash(process.env.CHRONOFACT_AGENT_API_URL ?? "http://127.0.0.1:3003");
const password = "Chronofact123!";

let cookie = "";

const result = await runSmoke();
console.log(JSON.stringify(result, null, 2));

async function runSmoke() {
  const stamp = Date.now();
  const primary = await registerUser(`chronofact-e2e-${stamp}@example.com`, "Chronofact E2E");
  const organization = await ensureOrganizationWithChronofactPermissions();

  const conversation = (await agentRequest("/agent/conversations", {
    method: "POST",
    expect: 201,
    body: {
      title: `limora e2e ${stamp}`,
      organization_id: organization.organizationId
    }
  })).conversation;

  assertEqual(conversation.organization_id, organization.organizationId, "conversation should use Limora organization");

  const fileContent = `Chronofact Limora E2E ${stamp}`;
  const contentBase64 = Buffer.from(fileContent, "utf8").toString("base64");
  const file = await agentRequest("/agent/files", {
    method: "POST",
    expect: 201,
    body: {
      conversation_id: conversation.conversation_id,
      organization_id: organization.organizationId,
      filename: `limora-e2e-${stamp}.txt`,
      content_base64: contentBase64,
      mime_type: "text/plain"
    }
  });

  assertEqual(file.organization_id, organization.organizationId, "uploaded file should use Limora organization");

  const query = await startRun({
    conversation_id: conversation.conversation_id,
    organization_id: organization.organizationId,
    message: "这个文件存证了吗",
    file_id: file.file_id
  });
  assertMatch(query.assistant.content, /没有找到|还没有|未存证/, "first query should report missing proof");

  const preserve = await startRun({
    conversation_id: conversation.conversation_id,
    organization_id: organization.organizationId,
    message: "确认存证",
    file_id: file.file_id,
    confirmed_action: true
  });
  const preservedFile = preserve.detail.files.find((item) => item.file_id === file.file_id);
  assert(preservedFile?.proof_id, "preserved file should have proof_id");
  assertMatch(preserve.assistant.content, /成功|已提交|已存证|完成存证/, "preserve reply should confirm success");

  const verify = await startRun({
    conversation_id: conversation.conversation_id,
    organization_id: organization.organizationId,
    message: "验证这个文件",
    file_id: file.file_id
  });
  assertMatch(verify.assistant.content, /一致|已存证|没有被修改|可以查验/, "verify reply should confirm matching content");

  const secondConversation = (await agentRequest("/agent/conversations", {
    method: "POST",
    expect: 201,
    body: {
      title: `same-org lookup ${stamp}`,
      organization_id: organization.organizationId
    }
  })).conversation;
  const sameOrgFile = await agentRequest("/agent/files", {
    method: "POST",
    expect: 201,
    body: {
      conversation_id: secondConversation.conversation_id,
      organization_id: organization.organizationId,
      filename: `same-name-${stamp}.txt`,
      content_base64: contentBase64,
      mime_type: "text/plain"
    }
  });
  assertEqual(sameOrgFile.document_match?.type, "exact", "same organization should find exact digest match");

  cookie = "";
  const isolated = await registerUser(`chronofact-e2e-b-${stamp}@example.com`, "Chronofact E2E B");
  const otherOrganization = await ensureOrganizationWithChronofactPermissions("Chronofact B Space");
  const otherConversation = (await agentRequest("/agent/conversations", {
    method: "POST",
    expect: 201,
    body: {
      title: `isolated org ${stamp}`,
      organization_id: otherOrganization.organizationId
    }
  })).conversation;
  const otherFile = await agentRequest("/agent/files", {
    method: "POST",
    expect: 201,
    body: {
      conversation_id: otherConversation.conversation_id,
      organization_id: otherOrganization.organizationId,
      filename: `limora-e2e-${stamp}.txt`,
      content_base64: contentBase64,
      mime_type: "text/plain"
    }
  });
  assert(
    otherFile.document_match?.type !== "exact",
    `cross-organization digest leaked: ${JSON.stringify(otherFile.document_match)}`
  );

  return {
    status: "passed",
    primary,
    isolated,
    organization_id: organization.organizationId,
    isolated_organization_id: otherOrganization.organizationId,
    conversation_id: conversation.conversation_id,
    file_id: file.file_id,
    sha256: file.sha256,
    proof_id: preservedFile.proof_id,
    query_reply: query.assistant.content,
    preserve_reply: preserve.assistant.content,
    verify_reply: verify.assistant.content,
    same_org_document_match: sameOrgFile.document_match,
    isolated_org_document_match: otherFile.document_match
  };
}

async function registerUser(email, name) {
  await limoraRequest("/v1/auth/register", {
    method: "POST",
    expect: 201,
    body: { name, email, password }
  });
  const session = (await limoraRequest("/v1/sessions/current")).data;
  assertEqual(session.identity.email, email, "Limora session identity should match registered email");
  return { email, identity_id: session.identity.id };
}

async function ensureOrganizationWithChronofactPermissions(name = "Chronofact 演示空间") {
  let session = (await limoraRequest("/v1/sessions/current")).data;
  let membership = session.memberships[0];
  if (!membership) {
    membership = (await limoraRequest("/v1/organizations", {
      method: "POST",
      expect: 201,
      body: { name }
    })).data.membership;
  }

  const permissions = [
    "chronofact.evidence.create",
    "chronofact.evidence.read",
    "chronofact.evidence.verify"
  ];
  const missing = permissions.filter((permission) => !membership.permissions.includes(permission));
  if (missing.length > 0) {
    await limoraRequest(
      `/v1/organizations/${encodeURIComponent(membership.organizationId)}/memberships/${encodeURIComponent(membership.id)}/permissions`,
      {
        method: "POST",
        body: { permissions: missing }
      }
    );
  }

  session = (await limoraRequest("/v1/sessions/current")).data;
  membership = session.memberships.find((item) => item.id === membership.id) ?? session.memberships[0];
  assert(membership, "Limora membership should exist after organization bootstrap");
  for (const permission of permissions) {
    assert(membership.permissions.includes(permission), `missing permission ${permission}`);
  }
  return {
    organizationId: membership.organizationId,
    membershipId: membership.id,
    organization: membership.organization
  };
}

async function startRun(input) {
  const payload = await agentRequest("/agent/runs", {
    method: "POST",
    expect: 202,
    body: input
  });
  const { detail, run } = await pollRun(input.conversation_id, payload.run.run_id);
  if (run.status !== "completed") {
    throw new Error(`Agent run failed: ${run.error ?? "unknown error"}`);
  }
  const assistant = detail.messages.find((message) => message.message_id === payload.assistant_message.message_id);
  assert(assistant, "assistant message should be present in conversation detail");
  return { payload, detail, run, assistant };
}

async function pollRun(conversationId, runId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const detail = await agentRequest(`/agent/conversations/${encodeURIComponent(conversationId)}`);
    const run = detail.runs.find((item) => item.run_id === runId);
    if (run?.status === "completed" || run?.status === "failed") {
      return { detail, run };
    }
    await delay(500);
  }
  throw new Error(`Agent run ${runId} did not finish`);
}

async function limoraRequest(path, options = {}) {
  return requestJson(limoraBaseUrl, path, options);
}

async function agentRequest(path, options = {}) {
  return requestJson(agentBaseUrl, path, options);
}

async function requestJson(baseUrl, path, { method = "GET", body, expect = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  absorbCookies(response.headers);

  const text = await response.text();
  const payload = text ? parseJson(text, `${method} ${path}`) : {};
  const expectedStatuses = Array.isArray(expect) ? expect : [expect];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected ${expectedStatuses.join("/")} got ${response.status}: ${text}`);
  }
  return payload;
}

function absorbCookies(headers) {
  const entries = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : headers.get("set-cookie")
      ? [headers.get("set-cookie")]
      : [];
  if (entries.length === 0) return;

  const jar = new Map(cookie
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }));

  for (const entry of entries) {
    const pair = entry.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator > 0) {
      jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  cookie = Array.from(jar, ([key, value]) => `${key}=${value}`).join("; ");
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 200)}`);
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

function assertMatch(actual, pattern, message) {
  if (!pattern.test(actual)) {
    throw new Error(`${message}. Received: ${actual}`);
  }
}
