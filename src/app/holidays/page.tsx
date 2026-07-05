"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HolidaysLocationSelector from "@/Components/HolidaysLocationSelector";

export default function HolidaysPage() {
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

  return <HolidaysLocationSelector headerProps={headerProps} />;
}
