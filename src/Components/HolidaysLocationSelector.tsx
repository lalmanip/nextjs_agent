"use client";

import Link from "next/link";
import { Globe, MapPin } from "lucide-react";
import Header from "@/Components/Header";
import Footer from "@/Components/Footer";

type HolidaysLocationSelectorProps = {
  headerProps: React.ComponentProps<typeof Header>;
};

const OPTIONS = [
  {
    id: "india",
    title: "India Locations",
    description: "Explore domestic destinations — experiences, states, and regions across India.",
    href: "/holidays/india",
    image: "/taj.jpg",
    icon: MapPin,
  },
  {
    id: "international",
    title: "International Locations",
    description: "Discover global holiday packages and trending international destinations.",
    href: "/holidays/international",
    image: "/statueofliberty.jpg",
    icon: Globe,
  },
] as const;

export default function HolidaysLocationSelector({ headerProps }: HolidaysLocationSelectorProps) {
  return (
    <>
      <Header {...headerProps} />

      <section className="bg-gradient-to-b from-orange-50 to-white py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Where would you like to travel?</h1>
          <p className="mt-3 text-gray-600">
            Choose between India and international holiday destinations to continue.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 px-4 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.id}
                href={option.href}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition hover:-translate-y-1 hover:border-primary hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={option.image}
                    alt={option.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white">
                    <span className="rounded-full bg-primary/90 p-2">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xl font-bold">{option.title}</span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm leading-relaxed text-gray-600">{option.description}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-primary group-hover:underline">
                    Continue →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Footer />
    </>
  );
}
