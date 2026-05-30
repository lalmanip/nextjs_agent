"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PackageInclusionHover from "@/Components/PackageInclusionHover";
import {
  CATEGORY_ICONS,
  destinationBaseName,
  destinationListingTitle,
  fetchDestination,
  fetchDestinationPackages,
  fetchHolidayCategories,
  type ApiDestination,
  type ApiPackageCard,
  type ApiPackageCategory,
} from "@/lib/holidaysApi";

type PackageCategory = {
  id: string;
  label: string;
  icon: string;
};

function formatPrice(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

function mapCategories(api: ApiPackageCategory[]): PackageCategory[] {
  return api.map((c) => ({
    id: c.code,
    label: c.label,
    icon: CATEGORY_ICONS[c.code] ?? "◎",
  }));
}

export default function InternationalPackagePage({
  destinationSlug,
}: {
  destinationSlug: string;
}) {
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("best-seller");
  const [destination, setDestination] = useState<ApiDestination | null>(null);
  const [packages, setPackages] = useState<ApiPackageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dest, cats] = await Promise.all([
          fetchDestination(destinationSlug),
          fetchHolidayCategories(),
        ]);
        if (cancelled) return;
        setDestination(dest);
        const mapped = mapCategories(cats);
        setCategories(mapped);
        if (mapped.length > 0) {
          setSelectedCategory(mapped[0].id);
        }
      } catch (err) {
        console.error("[InternationalPackagePage] init failed:", err);
        if (!cancelled) {
          setError("Could not load destination. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [destinationSlug]);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const data = await fetchDestinationPackages(
        destinationSlug,
        selectedCategory,
      );
      setPackages(data.packages);
      if (data.destination) setDestination(data.destination);
    } catch (err) {
      console.error("[InternationalPackagePage] packages failed:", err);
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, [destinationSlug, selectedCategory]);

  useEffect(() => {
    if (!selectedCategory || loading) return;
    loadPackages();
  }, [loadPackages, loading, selectedCategory]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="h-48 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </main>
    );
  }

  if (error || !destination) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-600">
          {error ?? "Destination not found."}
        </div>
      </main>
    );
  }

  const activeCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-5 pb-2">
              {categories.map((category) => {
                const active = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex w-28 flex-col items-center gap-2 text-center"
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "bg-gray-500 text-white hover:bg-gray-600"
                      }`}
                    >
                      {category.icon}
                    </span>
                    <span
                      className={`text-xs font-medium leading-tight ${
                        active ? "text-primary" : "text-gray-600"
                      }`}
                    >
                      {category.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative bg-cover bg-center"
        style={{ backgroundImage: `url('${destination.heroImageUrl}')` }}
      >
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 text-white">
          <p className="text-sm text-white/80">
            Home &gt; International Tour Packages &gt; {destinationListingTitle(destination.name)}
          </p>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
            {destinationListingTitle(destination.name)}
          </h1>
          <p className="mt-3 max-w-2xl text-white/90">{destination.description}</p>
          <p className="mt-4 text-sm">
            Starting from{" "}
            <span className="text-2xl font-bold">
              {formatPrice(destination.startingPrice)}
            </span>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activeCategory?.label ?? "Packages"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Choose from curated {destinationBaseName(destination.name)} packages. Hover on an image to see inclusions.
            </p>
          </div>
          <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option>Sort by Select</option>
            <option>Price - Low to High</option>
            <option>Price - High to Low</option>
            <option>Duration - Low to High</option>
          </select>
        </div>

        {packagesLoading ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className="mt-8 text-center text-gray-500">
            No packages in this category yet. Check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <article
                key={pkg.pkgId}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-xl"
              >
                <div className="group relative h-60 overflow-hidden bg-gray-200">
                  <img
                    src={pkg.imageUrl}
                    alt={pkg.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3 text-white">
                    {pkg.badge && (
                      <span className="rounded bg-red-500 px-2 py-1 text-xs font-semibold">
                        {pkg.badge}
                      </span>
                    )}
                    <span className="ml-auto rounded bg-black/40 px-2 py-1 text-sm">
                      {pkg.rating} ★ ({pkg.reviewCount})
                    </span>
                  </div>
                  <PackageInclusionHover inclusions={pkg.inclusions} />
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-bold leading-snug text-gray-900">
                    {pkg.title}
                  </h3>
                  <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {pkg.nights} Nights / {pkg.days} Days
                    </span>
                    <span className="text-yellow-500">★★★★★</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Package Price</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(pkg.price)}
                      </p>
                      <p className="text-xs text-gray-500">per person</p>
                    </div>
                    {pkg.detailUrl ? (
                      <Link
                        href={pkg.detailUrl}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                      >
                        View Details
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-500"
                        title="Details coming soon"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
