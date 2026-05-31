"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { ItineraryDay } from "@/lib/holidayPackages";

function formatMealAbbrev(meals: string): string {
  const m = meals.trim().toLowerCase();
  if (!m || m === "—") return "";
  const parts: string[] = [];
  if (m.includes("breakfast")) parts.push("B");
  if (m.includes("lunch")) parts.push("L");
  if (m.includes("dinner")) parts.push("D");
  return parts.length ? `(${parts.join(", ")})` : "";
}

function overnightLine(day: ItineraryDay): string {
  const meals = formatMealAbbrev(day.meals);
  const acc = day.accommodation?.trim();
  if (!acc || acc === "—") return meals;

  const overnight = acc.toLowerCase().startsWith("overnight")
    ? acc
    : `Overnight in ${acc.replace(/\.$/, "")}.`;

  return meals ? `${overnight} ${meals}` : overnight;
}

export default function PackageItineraryAccordion({
  days,
  fallbackImage,
}: {
  days: ItineraryDay[];
  fallbackImage: string;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleDay = (dayNumber: number) => {
    setExpandedDay((current) => (current === dayNumber ? null : dayNumber));
  };

  if (!days.length) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Itinerary details will be available soon.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {days.map((day, index) => {
        const open = expandedDay === day.day;
        const footer = overnightLine(day);

        return (
          <div
            key={day.day}
            className={open ? "bg-gray-50" : "bg-white"}
          >
            <button
              type="button"
              onClick={() => toggleDay(day.day)}
              aria-expanded={open}
              className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-6 sm:py-5"
            >
              <span className="shrink-0 rounded-full border-2 border-primary px-3 py-1 text-xs font-bold text-primary sm:px-4 sm:text-sm">
                Day {day.day}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900 sm:text-base">
                {day.title}
              </span>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700"
                aria-hidden
              >
                {open ? (
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                )}
              </span>
            </button>

            {open && (
              <div className="border-t border-gray-200 px-4 pb-6 pt-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="mx-auto w-full max-w-[140px] shrink-0 overflow-hidden rounded-lg bg-gray-200 sm:mx-0 sm:max-w-[160px] md:max-w-[180px]">
                    <img
                      src={fallbackImage}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-gray-700 sm:text-base">
                      {day.description}
                    </p>
                    {day.highlights.length > 0 && (
                      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-600">
                        {day.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                    {footer && (
                      <p className="mt-4 text-sm font-semibold text-gray-900">{footer}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {index < days.length - 1 && (
              <div className="border-b border-gray-200" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
