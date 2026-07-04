"use client";
import { useParams, useRouter } from "next/navigation";
import Header from "@/Components/Header";
import Footer from "@/Components/Footer";
import InternationalPackagePage from "@/Components/InternationalPackagePage";

export default function InternationalDestinationPage() {
  const router = useRouter();
  const params = useParams<{ destination: string }>();
  const destination = Array.isArray(params.destination)
    ? params.destination[0]
    : params.destination;

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
      <InternationalPackagePage destinationSlug={destination} />
      <Footer />
    </>
  );
}
