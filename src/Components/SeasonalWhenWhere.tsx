"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CloudRain, Snowflake, Sun } from "lucide-react";
import { fetchSeasons, type ApiSeason } from "@/lib/holidaysApi";

type Season = "winter" | "summer" | "monsoon";

type SeasonPackage = {
  id: string;
  title: string;
  days: string;
  price: number;
  img: string;
};

type SeasonContent = {
  headline: string;
  description: string;
  packages: SeasonPackage[];
};

const SEASON_ICONS: Record<Season, typeof Sun> = {
  winter: Snowflake,
  summer: Sun,
  monsoon: CloudRain,
};

const FALLBACK_SEASON_CONTENT: Record<Season, SeasonContent> = {
  winter: {
    headline: "Feel the winter charm with Vivance's specially curated holiday packages!",
    description:
      "Whether it's skiing down powdery slopes or enjoying a snug fireside stay, the ideal winter weather and experiences are ready for you.",
    packages: [
      {
        id: "w1",
        title: "Himachal - Shimla Manali",
        days: "6 Days",
        price: 23320,
        img: "/Himalaya.jpg",
      },
      {
        id: "w2",
        title: "Kashmir - Pahalgam Gulmarg Special",
        days: "7 Days",
        price: 46900,
        img: "/mountain.jpg",
      },
      {
        id: "w3",
        title: "Uttarakhand - Queen Of Hills",
        days: "3 Days",
        price: 14440,
        img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "w4",
        title: "Sikkim - Awesome Gangtok",
        days: "4 Days",
        price: 24330,
        img: "https://images.unsplash.com/photo-1472396961693-142e6e26973b?w=600&h=400&fit=crop&q=80",
      },
    ],
  },
  summer: {
    headline: "Feel the summer vibes with our exclusive holiday packages!",
    description:
      "From sun-kissed beaches to vibrant city escapes, soak up the perfect weather and create unforgettable memories. Your dream summer getaway awaits with Vivance!",
    packages: [
      {
        id: "s1",
        title: "Gujarat And Madhya Pradesh - Char Jyotirlinga Tour",
        days: "8 Days",
        price: 46600,
        img: "/SwarvedMahaMandir.jpg",
      },
      {
        id: "s2",
        title: "Passionate Paris",
        days: "4 Days",
        price: 81746,
        img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "s3",
        title: "Wonderful Bali - Honeymoon Special",
        days: "5 Days",
        price: 26562,
        img: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "s4",
        title: "Truly Dubai",
        days: "6 Days",
        price: 29556,
        img: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=400&fit=crop&q=80",
      },
    ],
  },
  monsoon: {
    headline: "Monsoon moods, made memorable with Vivance!",
    description:
      "Let the rains rejuvenate your spirit as you explore scenic destinations wrapped in the beauty of the monsoon season.",
    packages: [
      {
        id: "m1",
        title: "Hills of Kerala",
        days: "4 Days",
        price: 17320,
        img: "https://images.unsplash.com/photo-1602216052126-03a032634a34?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "m2",
        title: "Munnar Calling",
        days: "4 Days",
        price: 13300,
        img: "https://images.unsplash.com/photo-1593693397690-362cb6890497?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "m3",
        title: "Magical Nepal",
        days: "7 Days",
        price: 37499,
        img: "https://images.unsplash.com/photo-1544735716-392fe3899bb1?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "m4",
        title: "Wonders Of Shillong And Guwahati",
        days: "5 Days",
        price: 29899,
        img: "https://images.unsplash.com/photo-1472396961693-142e6e26973b?w=600&h=400&fit=crop&q=80",
      },
    ],
  },
};

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1509316785289-0252006092d4?w=1920&h=800&fit=crop&q=80";

function mapApiSeason(s: ApiSeason): { key: Season; label: string; content: SeasonContent } {
  const key = s.code as Season;
  return {
    key,
    label: s.label,
    content: {
      headline: s.headline,
      description: s.description,
      packages: s.packages.map((p, i) => ({
        id: `${key}-${i}`,
        title: p.title,
        days: p.daysLabel,
        price: p.price,
        img: p.imageUrl,
      })),
    },
  };
}

function formatPrice(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

export default function SeasonalWhenWhere() {
  const [season, setSeason] = useState<Season>("summer");
  const [seasonTabs, setSeasonTabs] = useState<
    { key: Season; label: string; content: SeasonContent }[]
  >([]);
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSeasons();
        if (cancelled) return;
        if (data?.seasons?.length) {
          const mapped = data.seasons.map(mapApiSeason);
          setSeasonTabs(mapped);
          setSeason(mapped[0]?.key ?? "summer");
          const bg = data.seasons.find((s) => s.backgroundUrl)?.backgroundUrl;
          if (bg) setBackgroundUrl(bg);
          return;
        }
      } catch (err) {
        console.warn("[SeasonalWhenWhere] API seasons unavailable, using fallback:", err);
      }
      if (!cancelled) {
        setSeasonTabs(
          (["winter", "summer", "monsoon"] as Season[]).map((key) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            content: FALLBACK_SEASON_CONTENT[key],
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTab = seasonTabs.find((t) => t.key === season) ?? seasonTabs[0];
  const content = activeTab?.content ?? FALLBACK_SEASON_CONTENT.summer;

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section
      className="relative bg-cover bg-center py-12 sm:py-14"
      style={{ backgroundImage: `url('${backgroundUrl}')` }}
    >
      <div className="absolute inset-0 bg-[#f3e8d8]/90" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">
          Not Sure When to Go or Where to Go?
        </h2>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {seasonTabs.map(({ key, label }) => {
            const Icon = SEASON_ICONS[key];
            const active = season === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSeason(key)}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-white shadow-md"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-8">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute -left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-primary hover:text-primary sm:-left-5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-primary hover:text-primary sm:-right-5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <article className="w-[280px] shrink-0 snap-start sm:w-[300px]">
              <div className="flex h-full min-h-[320px] flex-col justify-center rounded-xl bg-white/95 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                <h3 className="text-lg font-bold leading-snug text-gray-900">
                  {content.headline}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {content.description}
                </p>
              </div>
            </article>

            {content.packages.map((pkg) => (
              <article
                key={pkg.id}
                className="w-[260px] shrink-0 snap-start sm:w-[280px]"
              >
                <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                  <div className="h-[180px] overflow-hidden sm:h-[200px]">
                    <img
                      src={pkg.img}
                      alt={pkg.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
                      {pkg.title}
                    </h3>
                    <p className="mt-2 text-xs text-gray-500">{pkg.days}</p>
                    <p className="mt-1 text-base font-bold text-gray-900">
                      {formatPrice(pkg.price)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
