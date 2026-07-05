"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Binoculars,
  Building2,
  Calendar,
  Castle,
  ChevronDown,
  Clock,
  Heart,
  Landmark,
  Leaf,
  Map,
  MapPin,
  Menu,
  Mountain,
  Palmtree,
  Search,
  Ship,
  Star,
  Sun,
  Train,
  Trees,
  Umbrella,
  X,
} from "lucide-react";
import {
  INDIA_EXPERIENCES,
  INDIA_REGIONS,
  INDIA_STATES,
  indiaExperienceHref,
  indiaRegionHref,
  indiaStateHref,
  indiaTourPackagesHref,
} from "@/lib/indiaTourismNav";
import IndiaLanguageSelector from "./IndiaLanguageSelector";

type MenuKey = "experiences" | "india-tourism" | "regions" | null;

const EXPERIENCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  clock: Clock,
  heart: Heart,
  landmark: Landmark,
  mountain: Mountain,
  binoculars: Binoculars,
  leaf: Leaf,
  ship: Ship,
  building: Building2,
  trees: Trees,
  sun: Sun,
  map: Map,
  palmtree: Palmtree,
  umbrella: Umbrella,
  castle: Castle,
  train: Train,
  "map-pin": MapPin,
  star: Star,
};

function ExperienceIcon({ iconKey }: { iconKey: string }) {
  const Icon = EXPERIENCE_ICONS[iconKey] ?? MapPin;
  return <Icon className="h-4 w-4 shrink-0 text-primary" />;
}

export default function IndiaTourismHeader() {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToEnquiry = () => {
    setOpenMenu(null);
    const el = document.getElementById("tour-quote-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/holidays/india#tour-quote-form");
  };

  const toggleMenu = (key: MenuKey) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  const experienceColumns = [
    INDIA_EXPERIENCES.slice(0, 6),
    INDIA_EXPERIENCES.slice(6, 12),
    INDIA_EXPERIENCES.slice(12),
  ];

  const stateColumns = [
    INDIA_STATES.slice(0, 12),
    INDIA_STATES.slice(12, 24),
    INDIA_STATES.slice(24),
  ];

  return (
    <header className="sticky top-[var(--header-offset)] z-30 bg-white shadow-sm">
      <div ref={navRef} className="relative mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <nav className="hidden items-center gap-6 lg:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu("experiences")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${
                  openMenu === "experiences" ? "text-primary" : "text-gray-700 hover:text-primary"
                }`}
              >
                Experiences
                <ChevronDown className={`h-4 w-4 transition ${openMenu === "experiences" ? "rotate-180" : ""}`} />
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu("india-tourism")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${
                  openMenu === "india-tourism" ? "text-primary" : "text-gray-700 hover:text-primary"
                }`}
              >
                India Tourism
                <ChevronDown className={`h-4 w-4 transition ${openMenu === "india-tourism" ? "rotate-180" : ""}`} />
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu("regions")}
                className={`inline-flex items-center gap-1 text-sm font-medium transition ${
                  openMenu === "regions" ? "text-primary" : "text-gray-700 hover:text-primary"
                }`}
              >
                Regions
                <ChevronDown className={`h-4 w-4 transition ${openMenu === "regions" ? "rotate-180" : ""}`} />
              </button>
              {openMenu === "regions" && (
                <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-gray-100 bg-white py-3 shadow-lg">
                  <ul className="space-y-2.5 px-4">
                    {INDIA_REGIONS.map((region) => (
                      <li key={region.slug}>
                        <Link
                          href={indiaRegionHref(region.slug)}
                          onClick={() => setOpenMenu(null)}
                          className="block text-sm text-gray-700 transition hover:text-primary"
                        >
                          {region.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </nav>

          <Link href="/holidays/india" className="flex shrink-0 items-center gap-2">
            <span className="text-base font-bold tracking-tight text-primary sm:text-lg">
              India Holidays
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-primary hover:text-primary lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button type="button" aria-label="Search" className="hidden text-gray-600 hover:text-primary sm:block">
              <Search className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <IndiaLanguageSelector />
            </div>
            <Link href={indiaTourPackagesHref()} className="hidden text-sm font-medium text-gray-700 hover:text-primary md:inline">
              Tour Packages
            </Link>
            <button
              type="button"
              onClick={scrollToEnquiry}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Tour Enquiry
            </button>
          </div>
        </div>

        {openMenu === "experiences" && (
          <div className="absolute left-0 right-0 top-full z-50 border-t border-gray-100 bg-white/95 px-4 py-6 shadow-xl backdrop-blur-sm">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
              {experienceColumns.map((col, colIdx) => (
                <ul key={colIdx} className="space-y-3">
                  {col.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={indiaExperienceHref(item.slug)}
                        onClick={() => setOpenMenu(null)}
                        className="inline-flex items-center gap-2 text-sm text-gray-700 transition hover:text-primary"
                      >
                        <ExperienceIcon iconKey={item.iconKey} />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}

        {openMenu === "india-tourism" && (
          <div className="absolute left-0 right-0 top-full z-50 border-t border-gray-100 bg-white/95 px-4 py-6 shadow-xl backdrop-blur-sm">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
              {stateColumns.map((col, colIdx) => (
                <ul key={colIdx} className="space-y-2.5">
                  {col.map((state) => (
                    <li key={state.slug}>
                      <Link
                        href={indiaStateHref(state.slug)}
                        onClick={() => setOpenMenu(null)}
                        className="text-sm text-gray-700 transition hover:text-primary"
                      >
                        {state.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}

        {mobileOpen && (
          <div className="border-t border-gray-100 py-4 lg:hidden">
            <div className="mb-4 sm:hidden">
              <IndiaLanguageSelector />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Experiences</p>
            <ul className="mb-4 max-h-40 space-y-2 overflow-y-auto">
              {INDIA_EXPERIENCES.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={indiaExperienceHref(item.slug)}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-gray-700 hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">India Tourism</p>
            <ul className="mb-4 max-h-40 space-y-2 overflow-y-auto">
              {INDIA_STATES.map((state) => (
                <li key={state.slug}>
                  <Link
                    href={indiaStateHref(state.slug)}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-gray-700 hover:text-primary"
                  >
                    {state.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Regions</p>
            <ul className="space-y-2">
              {INDIA_REGIONS.map((region) => (
                <li key={region.slug}>
                  <Link
                    href={indiaRegionHref(region.slug)}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-gray-700 hover:text-primary"
                  >
                    {region.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
