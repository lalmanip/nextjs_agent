// Agent registration helpers. These route through the shared /api/auth server
// route so the upstream vivapi-user calls get the X-API-KEY + domain bearer
// token injected (same path the B2C AuthModal uses), rather than calling the
// backend directly from the browser.

async function postAuth(action: string, payload: Record<string, unknown>) {
  console.log(`[agentSignup] REQUEST action="${action}" ->`, "/api/auth", payload);
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  console.log(`[agentSignup] RESPONSE action="${action}" status=${res.status} body=`, text);
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected response from server (${res.status}).`);
  }
  if (!res.ok) {
    const fieldErrors = Array.isArray(data?.errors)
      ? data.errors.map((e: any) => `${e.field}: ${e.message}`).join("; ")
      : "";
    if (fieldErrors) {
      console.error(`[agentSignup] "${action}" validation failed:`, data.errors);
    }
    throw new Error(
      fieldErrors || data?.message || data?.error || `Request failed (${res.status}).`,
    );
  }
  return data;
}

export async function createAgentUser(payload: {
  email: string;
  userName: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: number;
  phone: string;
}) {
  const data = await postAuth("signup", {
    userType: "3",
    status: "0",
    emailActivation: false,
    ...payload,
  });
  const userId =
    data?.response?.userId ?? data?.userId ?? data?.response?.id ?? data?.id;
  if (userId == null) {
    throw new Error("Account created but no userId returned by the server.");
  }
  return { userId, raw: data };
}

export async function addAgentProfile(payload: {
  userId: string | number;
  address: string;
  countryName: number;
  state: string;
  city: string;
  pinCode: string;
  companyName: string;
  panNumber: string;
  gstNumber: string;
  officePhone: string;
}) {
  return postAuth("agent-add", {
    userType: 3,
    addressProof: null,
    panFilePath: null,
    gstFilePath: null,
    emailActivation: false,
    ...payload,
  });
}
