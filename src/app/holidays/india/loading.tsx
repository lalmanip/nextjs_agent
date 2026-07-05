import { Loader2 } from "lucide-react";
import IndiaTourismHeader from "@/Components/india-tourism/IndiaTourismHeader";

export default function IndiaHolidaysLoading() {
  return (
    <>
      <IndiaTourismHeader />
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 px-4 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium text-gray-700">Loading destination…</p>
        </div>
      </div>
    </>
  );
}
