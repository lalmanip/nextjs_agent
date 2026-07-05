"use client";

import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isIndiaHolidayNavigation(href: string, currentPathname: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith("/holidays/india")) return false;
    return url.pathname !== currentPathname;
  } catch {
    return false;
  }
}

export default function IndiaNavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !isIndiaHolidayNavigation(href, pathname)) return;
      setLoading(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  if (!loading) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 top-[var(--env-ribbon-height,0px)] z-[60] h-1 overflow-hidden bg-orange-100"
        aria-hidden
      >
        <div className="h-full w-2/5 animate-india-nav-progress bg-primary" />
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-label="Loading page"
        className="pointer-events-none fixed inset-x-0 top-[var(--india-page-header-offset)] z-[55] flex justify-center px-4 pt-4"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-sm font-medium text-gray-700 shadow-md backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading page…
        </div>
      </div>
    </>
  );
}
