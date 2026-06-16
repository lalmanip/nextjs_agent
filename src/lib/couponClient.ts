export type BookingChannel = "B2B" | "B2C";

export interface CouponValidateResult {
  valid: boolean;
  appliedToken?: string;
  promoCode?: string;
  discountAmount?: number;
  fareBefore?: number;
  fareAfter?: number;
  errorCode?: string;
  message?: string;
}

type GenericCouponResponse = {
  status?: string;
  message?: string;
  response?: {
    valid?: boolean;
    appliedToken?: string;
    promoCode?: string;
    discountAmount?: number;
    fareBefore?: number;
    fareAfter?: number;
    errorCode?: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID: "Invalid promo code",
  EXPIRED: "This promo code has expired",
  NOT_YET_VALID: "This promo code is not active yet",
  CHANNEL_MISMATCH: "This code is not valid for your booking type",
  NOT_ELIGIBLE: "This code cannot be used for this booking",
  MIN_FARE: "Booking amount is below the minimum for this code",
  LIMIT_REACHED: "You have already used this promo code",
  NOT_FOUND: "Promo session not found — please apply again",
  NOT_PENDING: "Promo session is no longer active",
  FORBIDDEN: "Promo does not belong to this user",
};

function mapResponse(data: GenericCouponResponse): CouponValidateResult {
  const r = data.response ?? {};
  const errorCode = r.errorCode;
  return {
    valid: Boolean(r.valid),
    appliedToken: r.appliedToken,
    promoCode: r.promoCode,
    discountAmount: r.discountAmount != null ? Number(r.discountAmount) : undefined,
    fareBefore: r.fareBefore != null ? Number(r.fareBefore) : undefined,
    fareAfter: r.fareAfter != null ? Number(r.fareAfter) : undefined,
    errorCode,
    message:
      data.message ||
      (errorCode ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.INVALID : undefined),
  };
}

export function getBookingChannel(): BookingChannel {
  const ch = String(process.env.NEXT_PUBLIC_BOOKING_CHANNEL || "B2B").toUpperCase();
  return ch === "B2C" ? "B2C" : "B2B";
}

export async function validateCoupon(params: {
  code: string;
  userOid: number;
  channel?: BookingChannel;
  totalFare: number;
  resultTokenHash?: string;
}): Promise<CouponValidateResult> {
  const res = await fetch("/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: params.code,
      userOid: params.userOid,
      channel: params.channel ?? getBookingChannel(),
      totalFare: params.totalFare,
      resultTokenHash: params.resultTokenHash,
    }),
  });
  const data = (await res.json()) as GenericCouponResponse;
  return mapResponse(data);
}

export async function releaseCoupon(params: {
  appliedToken: string;
  userOid: number;
}): Promise<CouponValidateResult> {
  const res = await fetch("/api/coupons/release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as GenericCouponResponse;
  return mapResponse(data);
}

export async function redeemCoupon(params: {
  appliedToken: string;
  userOid: number;
  appReference?: string;
  paymentOrderId?: string;
}): Promise<CouponValidateResult> {
  const res = await fetch("/api/coupons/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as GenericCouponResponse;
  return mapResponse(data);
}

export function couponErrorMessage(result: CouponValidateResult): string {
  if (result.message) return result.message;
  if (result.errorCode) return ERROR_MESSAGES[result.errorCode] || ERROR_MESSAGES.INVALID;
  return ERROR_MESSAGES.INVALID;
}
