"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/Components/Header";
import IndiaGoogleTranslate from "./IndiaGoogleTranslate";
import IndiaNavigationProgress from "./IndiaNavigationProgress";

export default function IndiaHolidaysLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, setUser] = useState<any>(() => {
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
      <IndiaGoogleTranslate />
      <Header {...headerProps} />
      <IndiaNavigationProgress />
      {children}
    </>
  );
}
