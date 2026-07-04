"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import Footer from "@/Components/Footer";
import { SearchPage } from "@/Components/hotel-search/SearchPage";

export default function HotelsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  }, []);

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: any) => {
      setUser(userData);
      try {
        localStorage.setItem("user", JSON.stringify(userData));
      } catch {}
    },
  };

  return (
    <>
      <Header {...headerProps} />
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <SearchPage />
      </Suspense>
      <Footer />
    </>
  );
}
