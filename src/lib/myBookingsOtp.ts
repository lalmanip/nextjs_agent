/** OTP request types for vivapi-user `/user/GenerateOTP` and `/user/VerifyOTP`. */
export const MY_BOOKINGS_CANCEL_OTP_REQUEST_TYPE = "TICKET_CANCEL_REQ";
export const MY_BOOKINGS_VIEW_OTP_REQUEST_TYPE = "TICKET_VIEW_REQ";

export function isOtpApiSuccess(data: unknown, responseOk: boolean): boolean {
  if (!responseOk) return false;
  const d = data as Record<string, unknown> | null;
  const status = String(d?.status ?? d?.Status ?? "").toLowerCase();
  return status === "success" || status === "ok" || status === "1";
}

export function otpApiMessage(data: unknown, fallback: string): string {
  const d = data as Record<string, unknown> | null;
  return String(d?.message ?? d?.Message ?? d?.error ?? fallback);
}
