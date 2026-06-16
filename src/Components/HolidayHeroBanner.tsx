"use client";
import { useEffect, useState } from "react";
import { fetchHolidayHero, type ApiHeroSlide } from "@/lib/holidaysApi";
import { resolveHolidayImageUrl } from "@/lib/holidayImageUrl";

const ROTATE_MS = 5000;

type HeroSlide = {
  img: string;
  title: string;
  subtitle: string;
  objectPosition?: string;
  fit?: "cover" | "contain";
};

function mapSlide(slide: ApiHeroSlide): HeroSlide {
  return {
    img: resolveHolidayImageUrl(slide.imageUrl),
    title: slide.title,
    subtitle: slide.subtitle ?? "",
    objectPosition: slide.objectPosition ?? "center",
    fit: slide.objectFit === "contain" ? "contain" : "cover",
  };
}

function PartnerTicker({ items }: { items: string[] }) {
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden bg-neutral-900 py-3.5">
      <div className="flex w-max animate-marquee-rtl">
        {doubled.map((text, i) => (
          <span
            key={`${text}-${i}`}
            className="inline-flex shrink-0 items-center px-8 text-sm text-white"
          >
            <span className="mr-3 inline-block h-2 w-2 rounded-full bg-primary" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HolidayHeroBanner() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchHolidayHero();
        if (cancelled) return;
        setSlides(data.slides.map(mapSlide));
        setTickerItems(data.tickerItems);
      } catch (err) {
        console.error("[HolidayHeroBanner] Failed to load hero:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (loading) {
    return (
      <section className="bg-white py-4 sm:py-6">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 lg:px-6">
          <div className="aspect-[5/2] max-h-[520px] min-h-[280px] animate-pulse rounded-2xl bg-gray-200" />
        </div>
      </section>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-4 sm:py-6">
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5">
          <div className="relative w-full overflow-hidden aspect-[5/2] max-h-[520px] min-h-[280px]">
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {slides.map((slide) => (
                <div
                  key={slide.img + slide.title}
                  className="relative h-full min-w-full w-full flex-shrink-0 bg-neutral-950"
                >
                  <img
                    src={slide.img}
                    alt={slide.title}
                    className={`h-full w-full ${
                      slide.fit === "contain" ? "object-contain" : "object-cover"
                    }`}
                    style={{
                      objectPosition: slide.objectPosition ?? "center",
                    }}
                    loading="eager"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                    <h2 className="text-2xl font-bold sm:text-4xl lg:text-5xl">
                      {slide.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm sm:text-lg text-white/90">
                      {slide.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    active === i ? "w-6 bg-white" : "w-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {tickerItems.length > 0 && <PartnerTicker items={tickerItems} />}
        </div>
      </div>
    </section>
  );
}
