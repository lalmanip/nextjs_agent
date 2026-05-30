"use client";

import { useEffect, useMemo, useState } from "react";
import type { PackageDetailContent } from "@/lib/holidayPackages";
import {
  DETAIL_CATEGORY_LABELS,
  getAvailableDetailCategories,
  getDefaultDetailCategory,
  resolveDetailSections,
  type DetailCategoryId,
} from "@/lib/packageDetailSections";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-gray-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CategoryContent({
  categoryId,
  sections,
}: {
  categoryId: DetailCategoryId;
  sections: ReturnType<typeof resolveDetailSections>;
}) {
  switch (categoryId) {
    case "highlights":
      return (
        <div className="space-y-5">
          {sections.locationHighlights?.map((group) => (
            <p key={group.location} className="text-sm leading-relaxed text-gray-800">
              <span className="font-bold uppercase tracking-wide text-gray-900">
                {group.location}:
              </span>{" "}
              {group.items.join(" | ")}
            </p>
          ))}
          {sections.highlights.length > 0 && <BulletList items={sections.highlights} />}
          {sections.whatsMore.length > 0 && (
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-gray-900">
                What&apos;s more during the tour
              </p>
              <ul className="mt-4 space-y-3 border-l-2 border-gray-200 pl-4">
                {sections.whatsMore.map((item) => (
                  <li key={item} className="relative flex gap-3 text-sm leading-relaxed text-gray-800">
                    <span className="absolute -left-[1.35rem] top-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-2 ring-white" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case "flights":
      return <p className="text-sm leading-relaxed text-gray-700">{sections.flightsNote}</p>;
    case "transfer":
      return <BulletList items={sections.transfer} />;
    case "visa":
      return <p className="text-sm leading-relaxed text-gray-700">{sections.visaNote}</p>;
    case "sightseeing":
      return <BulletList items={sections.sightseeing} />;
    case "accommodation":
      return (
        <div className="space-y-4">
          {sections.hotels.map((hotel) => (
            <div key={hotel.name} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <p className="font-semibold text-gray-900">{hotel.name}</p>
              <p className="mt-1 text-sm text-gray-600">
                {hotel.nights}
                {hotel.mealPlan ? ` · ${hotel.mealPlan}` : ""}
              </p>
            </div>
          ))}
        </div>
      );
    case "meals":
      return (
        <div className="space-y-4">
          {sections.meals.length > 0 && <BulletList items={sections.meals} />}
          {sections.hotels
            .filter((h) => h.mealPlan?.trim())
            .map((hotel) => (
              <p key={`${hotel.name}-meals`} className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{hotel.name}:</span>{" "}
                {hotel.mealPlan}
              </p>
            ))}
        </div>
      );
    case "inclusion-exclusions":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          {sections.inclusions.length > 0 && (
            <div>
              <h3 className="font-bold text-green-700">Inclusions</h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-700">
                {sections.inclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {sections.exclusions.length > 0 && (
            <div>
              <h3 className="font-bold text-red-700">Exclusions</h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-700">
                {sections.exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

export default function PackageDetailsPanel({
  details,
}: {
  details: PackageDetailContent;
}) {
  const categories = useMemo(() => getAvailableDetailCategories(details), [details]);
  const sections = useMemo(() => resolveDetailSections(details), [details]);
  const [activeCategory, setActiveCategory] = useState<DetailCategoryId | null>(
    () => getDefaultDetailCategory(details),
  );

  useEffect(() => {
    setActiveCategory(getDefaultDetailCategory(details));
  }, [details]);

  if (!categories.length || !activeCategory) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Package details will be available soon.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto border-b border-gray-200 bg-gray-50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max px-2">
          {categories.map((category) => {
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-700 hover:text-gray-900"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900">
          {DETAIL_CATEGORY_LABELS[activeCategory]}
        </h2>
        <div className="mt-4">
          <CategoryContent categoryId={activeCategory} sections={sections} />
        </div>
      </div>
    </div>
  );
}
