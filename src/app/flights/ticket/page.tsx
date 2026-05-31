"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import TicketConfirmation from "@/Components/TicketConfirmation";
import Footer from "@/Components/Footer";
import { bookingState, type TicketDataState } from "@/lib/bookingState";

export default function TicketPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [ticketState, setTicketState] = useState<TicketDataState | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setTicketState(bookingState.getTicket());
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !ticketState?.pnr && !ticketState?.appReference) router.replace("/");
  }, [mounted, ticketState, router]);

  if (!mounted || (!ticketState?.pnr && !ticketState?.appReference)) return null;

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHolidays: () => router.push("/holidays"),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: any) => {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    },
  };

  return (
    <>
      <Header {...headerProps} />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TicketConfirmation
            ticketDetails={ticketState!.ticketDetails}
            pnr={ticketState!.pnr}
            appReference={ticketState!.appReference}
            domainToken={ticketState!.domainToken}
            onClose={() => router.push("/")}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
