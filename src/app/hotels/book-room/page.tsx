import { Suspense } from "react";
import { BookRoomPage } from "@/Components/hotel-search/BookRoomPage";

export default function HotelsBookRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BookRoomPage />
    </Suspense>
  );
}

