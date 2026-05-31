"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CommitFailedScreen from "@/Components/CommitFailedScreen";
import { PENDING_BOOKING_KEY } from "@/lib/bookingState";

export default function PaymentFailedPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING_BOOKING_KEY);
      if (saved) setPendingData(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!pendingData?.flightData || !pendingData?.paymentProof)) {
      router.replace("/");
    }
  }, [mounted, pendingData, router]);

  if (!mounted || !pendingData?.flightData || !pendingData?.paymentProof) return null;

  const leadPax = pendingData.pData?.passengerDetails?.[0];
  const leadName = leadPax
    ? `${leadPax.firstName || ""} ${leadPax.lastName || ""}`.trim()
    : "Passenger";
  const totalFare =
    pendingData.flightData?.price?.totalDisplayFare ||
    pendingData.flightData?.Price?.TotalDisplayFare ||
    0;

  return (
    <CommitFailedScreen
      paymentProof={pendingData.paymentProof}
      amountPaid={totalFare}
      leadPassengerName={leadName}
      appReference={pendingData.appReference}
      partialPnr={pendingData.partialPnr}
      paymentValidation={pendingData.paymentValidation}
      failedAt={pendingData.failedAt}
      errorMessage={pendingData.errorMessage}
      onHome={() => {
        localStorage.removeItem(PENDING_BOOKING_KEY);
        setPendingData(null);
        router.push("/");
      }}
    />
  );
}
