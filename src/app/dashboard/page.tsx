"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import UserDashboard from "@/Components/UserDashboard";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";
  const bookingsRefreshKey = searchParams.toString();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("user");
      setUser(saved ? JSON.parse(saved) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Only redirect after we've mounted and attempted to read localStorage,
    // otherwise we can bounce back to home before `user` is populated.
    if (!mounted) return;
    if (!user) router.replace("/");
  }, [mounted, user, router]);

  // Keep server + first client render consistent to avoid hydration mismatch.
  if (!mounted) return <div className="min-h-screen bg-gray-50" />;
  if (!user) return null;

  return (
    <UserDashboard
      user={user}
      onBack={() => router.push("/")}
      initialTab={tab}
      bookingsRefreshKey={bookingsRefreshKey}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <DashboardContent />
    </Suspense>
  );
}
