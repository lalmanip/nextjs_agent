"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  destinationListingHref,
  destinationListingTitle,
  fetchTrendingDestinations,
  type ApiTrendingDestination,
} from "@/lib/holidaysApi";
import { resolveHolidayImageUrl } from "@/lib/holidayImageUrl";

export type DestinationTile = {
  id: string;
  title: string;
  img: string;
  price: number;
  href?: string;
};

function mapTrendingTile(d: ApiTrendingDestination): DestinationTile {
  const href =
    d.listingPath?.trim() ||
    (d.slug?.trim() ? destinationListingHref(d.slug.trim()) : undefined);
  return {
    id: String(d.id),
    title: destinationListingTitle(d.name),
    img: resolveHolidayImageUrl(d.imageUrl),
    price: d.startingPrice,
    href,
  };
}

function formatPrice(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

function TrendingRow({
  title,
  description,
  tiles,
  variant = "light",
  loading,
}: {
  title: string;
  description?: string;
  tiles: DestinationTile[];
  variant?: "light" | "muted";
  loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -260 : 260,
      behavior: "smooth",
    });
  };

  return (
    <section className={variant === "muted" ? "bg-gray-50 py-10" : "bg-white py-10"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
        {description && (
          <p className="mt-3 max-w-5xl text-sm leading-relaxed text-gray-600">
            {description}
          </p>
        )}

        {loading ? (
          <div className="mt-6 flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[340px] w-[220px] shrink-0 animate-pulse rounded-xl bg-gray-200"
              />
            ))}
          </div>
        ) : (
          <div className="relative mt-6">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="absolute -left-3 top-[38%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-primary hover:text-primary sm:-left-5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="absolute -right-3 top-[38%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-primary hover:text-primary sm:-right-5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {tiles.map((tile) => {
                const card = (
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md">
                    <div className="h-[260px] overflow-hidden sm:h-[280px]">
                      <img
                        src={tile.img}
                        alt={tile.title}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
                        {tile.title}
                      </h3>
                      <p className="mt-2 text-xs text-gray-500">Starting from</p>
                      <p className="text-base font-bold text-gray-900">
                        {formatPrice(tile.price)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <article
                    key={tile.id}
                    className="w-[200px] shrink-0 snap-start sm:w-[220px]"
                  >
                    {tile.href ? (
                      <Link href={tile.href} className="block">
                        {card}
                      </Link>
                    ) : (
                      card
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TrendingDestinations() {
  const [international, setInternational] = useState<DestinationTile[]>([]);
  const [india, setIndia] = useState<DestinationTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [intl, ind] = await Promise.all([
          fetchTrendingDestinations("international"),
          fetchTrendingDestinations("india"),
        ]);
        if (cancelled) return;
        setInternational(intl.map(mapTrendingTile));
        setIndia(ind.map(mapTrendingTile));
      } catch (err) {
        console.error("[TrendingDestinations] Failed to load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TrendingRow
        title="Trending International Destinations"
        description="Planning to travel abroad? Discover the most popular international tour packages trending this season — from romantic beach escapes and historic cities to cultural experiences across the globe."
        tiles={international}
        variant="light"
        loading={loading}
      />
      <TrendingRow
        title="Trending India and Around Destinations"
        description="Explore India and neighbouring destinations with curated packages — spiritual journeys, wildlife safaris, mountains, beaches, and heritage trails."
        tiles={india}
        variant="muted"
        loading={loading}
      />
    </>
  );
}
