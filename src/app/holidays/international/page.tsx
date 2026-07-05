"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import HolidayPartnersScroll from "@/Components/HolidayPartnersScroll";
import Footer from "@/Components/Footer";

export default function InternationalHolidaysPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

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
      <HolidayPartnersScroll internationalOnly />
      <Footer />
    </>
  );
}
