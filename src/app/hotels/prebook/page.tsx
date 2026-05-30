import { Suspense } from "react";
import { PrebookPage } from "@/Components/hotel-search/PrebookPage";

export default function HotelsPrebookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <PrebookPage />
    </Suspense>
  );
}

