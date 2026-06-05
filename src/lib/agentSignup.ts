// Agent registration helpers. These route through the shared /api/auth server
// route so the upstream vivapi-user calls get the X-API-KEY + domain bearer
// token injected (same path the B2C AuthModal uses), rather than calling the
// backend directly from the browser.

export type AgentDocumentKind = "ADDRESS_PROOF" | "PAN" | "GST";

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

function extractStoredPath(data: any): string {
  const path =
    data?.response?.storedPath ??
    data?.storedPath ??
    data?.response?.stored_path;
  if (!path || typeof path !== "string") {
    throw new Error("Upload succeeded but no file path was returned.");
  }
  return path;
}

/** Upload one KYC document after user account exists. */
export async function uploadAgentDocument(
  userId: string | number,
  documentType: AgentDocumentKind,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("userId", String(userId));
  form.append("documentType", documentType);
  form.append("file", file, file.name);

  const res = await fetch("/api/agent/documents/upload", {
    method: "POST",
    body: form,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected upload response (${res.status}).`);
  }
  if (!res.ok || data?.status === "failed") {
    throw new Error(data?.message || data?.error || `Document upload failed (${res.status}).`);
  }
  return extractStoredPath(data);
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
  city: number;
  cityName: string;
  pinCode: string;
  companyName: string;
  corporateId: string;
  salesPersonName: string;
  panNumber: string;
  panCardHolderName: string;
  gstNumber: string;
  officePhone: string;
  establishmentDate: string;
  annualTransactionAmount: number;
  noOfEmployees: number;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountHolderName: string;
  addressProof: string;
  panFilePath: string;
  gstFilePath: string;
}) {
  return postAuth("agent-add", {
    userType: 3,
    emailActivation: false,
    ...payload,
  });
}

export type AgentUploadedDocuments = {
  addressProof: string;
  panFilePath: string;
  gstFilePath: string;
};

/** Upload address proof, PAN, and GST files for a new agent user. */
export async function uploadAgentSignupDocuments(
  userId: string | number,
  files: {
    addressProof: File;
    panFile: File;
    gstFile: File;
  },
): Promise<AgentUploadedDocuments> {
  const addressProof = await uploadAgentDocument(userId, "ADDRESS_PROOF", files.addressProof);
  const panFilePath = await uploadAgentDocument(userId, "PAN", files.panFile);
  const gstFilePath = await uploadAgentDocument(userId, "GST", files.gstFile);
  return { addressProof, panFilePath, gstFilePath };
}
