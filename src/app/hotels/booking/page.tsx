import { Suspense } from "react";
import { BookingPage } from "@/Components/hotel-search/BookingPage";

export default function HotelsBookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BookingPage />
    </Suspense>
  );
}

