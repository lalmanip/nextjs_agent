"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  INDIA_EXPERIENCES,
  INDIA_HERO_SLIDES,
  INDIA_REGIONS,
  indiaExperienceHref,
  indiaRegionHref,
  indiaStateHref,
} from "@/lib/indiaTourismNav";
import IndiaTourQuoteSidebar from "./IndiaTourQuoteSidebar";
import IndiaTourismHeader from "./IndiaTourismHeader";
import Footer from "@/Components/Footer";

const ROTATE_MS = 5000;

export default function IndiaTourismHome() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % INDIA_HERO_SLIDES.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <IndiaTourismHeader />

      <section className="relative min-h-[420px] overflow-hidden sm:min-h-[520px]">
        {INDIA_HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.imageUrl}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === activeSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <img src={slide.imageUrl} alt={slide.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ))}
        <div className="relative flex min-h-[420px] flex-col justify-end px-6 pb-16 pt-24 sm:min-h-[520px] sm:px-12">
          <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-5xl lg:text-6xl">
            {INDIA_HERO_SLIDES[activeSlide].title}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg">
            {INDIA_HERO_SLIDES[activeSlide].subtitle}
          </p>
        </div>
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {INDIA_HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setActiveSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeSlide ? "w-6 bg-white" : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Popular Experiences</h2>
          <p className="mt-2 text-gray-600">Curated holiday themes across India</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {INDIA_EXPERIENCES.slice(0, 12).map((exp) => (
            <Link
              key={exp.slug}
              href={indiaExperienceHref(exp.slug)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <span className="text-sm font-medium text-gray-800">{exp.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Explore by Region</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDIA_REGIONS.map((region) => (
              <Link
                key={region.slug}
                href={indiaRegionHref(region.slug)}
                className="rounded-xl bg-white p-6 text-center shadow-sm transition hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-gray-900">{region.name}</h3>
                <p className="mt-1 text-sm text-primary">View destinations →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Plan Your India Holiday</h2>
            <p className="mt-4 leading-relaxed text-gray-700">
              From the snow-capped Himalayas to sun-kissed beaches, from ancient temples to vibrant
              cities — India offers endless possibilities. Browse experiences, states, and regions
              using the navigation above, or fill out the enquiry form to receive a personalized quote.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={indiaStateHref("rajasthan")}
                className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white"
              >
                Rajasthan
              </Link>
              <Link
                href={indiaStateHref("kerala")}
                className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white"
              >
                Kerala
              </Link>
              <Link
                href={indiaStateHref("goa")}
                className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white"
              >
                Goa
              </Link>
              <Link
                href={indiaExperienceHref("golden-triangle")}
                className="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white"
              >
                Golden Triangle
              </Link>
            </div>
          </div>
          <IndiaTourQuoteSidebar destinationLabel="India Holiday" id="tour-quote-form" />
        </div>
      </section>

      <Footer />
    </>
  );
}
