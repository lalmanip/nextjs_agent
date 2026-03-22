const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const PROXY = "/api/proxy";

export async function createUser(payload: {
  email: string;
  userName: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: number;
}) {
  const reqBody = { ...payload, userType: "4", status: "0", emailActivation: false };
  console.log("[createUser] REQUEST", `${PROXY}/vivapi-user/user/create`, reqBody);
  const res = await fetch(`${PROXY}/vivapi-user/user/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  const data = await res.json();
  console.log("[createUser] RESPONSE", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function addAgent(payload: {
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
  const reqBody = { ...payload, userType: 3, addressProof: null, panFilePath: null, gstFilePath: null, emailActivation: false };
  console.log("[addAgent] REQUEST", `${PROXY}/vivapi-user/user/agent/add`, reqBody);
  const res = await fetch(`${PROXY}/vivapi-user/user/agent/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  const data = await res.json();
  console.log("[addAgent] RESPONSE", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function authenticate(userName: string, password: string) {
  const reqBody = { userName, password };
  console.log("[authenticate] REQUEST", `${PROXY}/vivapi-user/user/authenticate`, reqBody);
  const res = await fetch(`${PROXY}/vivapi-user/user/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  const data = await res.json();
  console.log("[authenticate] RESPONSE", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function getProfile(userId: string | number, token: string) {
  console.log("[getProfile] REQUEST", `${PROXY}/vivapi-user/user/agent/${userId}`);
  const res = await fetch(`${PROXY}/vivapi-user/user/agent/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log("[getProfile] RESPONSE", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function updateProfile(userId: string | number, token: string, payload: Record<string, unknown>) {
  console.log("[updateProfile] REQUEST", `${PROXY}/vivapi-user/user/agent/update/${userId}`, payload);
  const res = await fetch(`${PROXY}/vivapi-user/user/agent/update/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log("[updateProfile] RESPONSE", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function changePassword(userName: string, password: string) {
  const reqBody = { userName, password };
  console.log("[changePassword] REQUEST", `${PROXY}/vivapi-user/user/reset`, reqBody);
  const res = await fetch(`${PROXY}/vivapi-user/user/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  const data = await res.json();
  console.log("[changePassword] RESPONSE", res.status, data);
  if (!res.ok || data.response !== "success") throw new Error(data.message ?? "Failed to change password.");
  return data;
}
