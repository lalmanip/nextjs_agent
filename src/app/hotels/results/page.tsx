"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import HotelResults from "@/Components/HotelResults";
import Footer from "@/Components/Footer";
import { bookingState, type HotelSearchState } from "@/lib/bookingState";

export default function HotelResultsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [hotelSearch, setHotelSearch] = useState<HotelSearchState | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setHotelSearch(bookingState.getHotelSearch());
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !hotelSearch) router.replace("/");
  }, [mounted, hotelSearch, router]);

  if (!mounted || !hotelSearch) return null;

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
      <HotelResults
        hotels={hotelSearch.results}
        searchParams={hotelSearch.params}
        onBack={() => router.push("/")}
      />
      <Footer />
    </>
  );
}
