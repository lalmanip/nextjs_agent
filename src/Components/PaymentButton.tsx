"use client";
import { useState } from "react";
import { flightAPI, paymentAPI } from "@/lib/api";

interface PaymentButtonProps {
  resultToken: string;
  domainToken: string;
  totalAmount: number;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentError: (error: string) => void;
}

interface PaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export default function PaymentButton({
  resultToken,
  domainToken,
  totalAmount,
  onPaymentSuccess,
  onPaymentError,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {

      // 1. Initiate payment — backend decides gateway
      const orderResponse = await flightAPI.initiatePayment(
        resultToken,
        domainToken
      );

      if (!orderResponse.pgatewayOrderId) {
        throw new Error("Failed to initiate payment");
      }

      const tokenForPaymentApis =
        (await flightAPI.getDomainToken().catch(() => "")) || domainToken;

      const { pgatewayOrderId, pgateway } = orderResponse;

      // 2. Process Razorpay payment
      const paymentResponse = await paymentAPI.processRazorpayPayment(
        pgatewayOrderId,
        totalAmount
      );

      // 3. Validate payment with same domain token
      const response = paymentResponse as PaymentResponse;
      const validationResponse = await flightAPI.validatePayment(
        {
          payId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          pgateway: pgateway || "Razorpay",
        },
        tokenForPaymentApis
      );

      onPaymentSuccess(validationResponse);
    } catch (error) {
      console.error("Payment Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Payment failed";
      onPaymentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
    >
      {loading ? "Processing Payment..." : `Pay ₹${totalAmount?.toLocaleString()}`}
    </button>
  );
}
