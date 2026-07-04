"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/Components/Header";
import Footer from "@/Components/Footer";
import InternationalPackageDetailPage from "@/Components/InternationalPackageDetailPage";
import {
  apiPackageToTourDetail,
  fetchPackageDetail,
  fetchPackageDetailBySlug,
} from "@/lib/holidaysApi";
import {
  getPackageDetail,
  getPackageDetailBySlug,
  type TourPackageDetail,
} from "@/lib/holidayPackages";
import Link from "next/link";

export default function PackageDetailRoutePage() {
  const router = useRouter();
  const params = useParams<{ destination: string; packageSlug: string }>();
  const searchParams = useSearchParams();
  const destination = Array.isArray(params.destination)
    ? params.destination[0]
    : params.destination;
  const packageSlug = Array.isArray(params.packageSlug)
    ? params.packageSlug[0]
    : params.packageSlug;
  const pkgId = searchParams.get("pkgId");

  const [pkg, setPkg] = useState<TourPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let apiPkg = null;
        if (pkgId) {
          apiPkg = await fetchPackageDetail(pkgId);
        }
        if (!apiPkg && destination && packageSlug) {
          apiPkg = await fetchPackageDetailBySlug(destination, packageSlug);
        }
        if (cancelled) return;
        if (apiPkg) {
          setPkg(apiPackageToTourDetail(apiPkg));
          return;
        }
      } catch (err) {
        console.warn(
          "[PackageDetail] API unavailable, using local fallback:",
          err,
        );
      }

      if (cancelled) return;
      const fallback = pkgId
        ? getPackageDetail(pkgId)
        : getPackageDetailBySlug(destination, packageSlug);
      setPkg(fallback);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pkgId, destination, packageSlug]);

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: unknown) => {
      localStorage.setItem("user", JSON.stringify(userData));
    },
  };

  if (loading) {
    return (
      <>
        <Header {...headerProps} />
        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
        </main>
        <Footer />
      </>
    );
  }

  if (!pkg) {
    return (
      <>
        <Header {...headerProps} />
        <main className="mx-auto max-w-7xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Package not found</h1>
          <Link
            href={`/international-tour-packages/${destination}`}
            className="mt-4 inline-block text-primary hover:underline"
          >
            Back to tour packages
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header {...headerProps} />
      <InternationalPackageDetailPage pkg={pkg} />
      <Footer />
    </>
  );
}
