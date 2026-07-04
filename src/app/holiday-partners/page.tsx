"use client";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import HolidayPartnersScroll from "@/Components/HolidayPartnersScroll";
import Footer from "@/Components/Footer";

export default function HolidayPartnersPage() {
  const router = useRouter();

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: unknown) => {
      localStorage.setItem("user", JSON.stringify(userData));
    },
  };

  return (
    <>
      <Header {...headerProps} />
      <HolidayPartnersScroll />
      <Footer />
    </>
  );
}
