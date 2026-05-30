"use client";

import React, { useMemo } from "react";
import { FiltersState, HotelApiItem, SortOption } from "./types";

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

function clampNumber(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FiltersSidebar({
  hotels,
  filters,
  onChange,
  isCompact = false,
}: {
  hotels: HotelApiItem[];
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  isCompact?: boolean;
}) {
  const stats = useMemo(() => {
    const prices = hotels.map((h) => h.startingPrice).filter((p) => Number.isFinite(p));
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 1000;
    return { min, max };
  }, [hotels]);

  const update = (patch: Partial<FiltersState>) => onChange({ ...filters, ...patch });

  const sortOptions: Array<{ id: SortOption; label: string; icon: string }> = [
    { id: "price_asc", label: "Price: Low to High", icon: "↑" },
    { id: "rating_desc", label: "Rating: High to Low", icon: "★" },
  ];

  const hasActiveFilters =
    filters.priceMin > 0 || filters.priceMax > 0 || filters.stars.length > 0;

  return (
    <aside className="rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">

      {/* Header accent bar */}
      <div className="bg-gradient-to-r from-primary to-orange-500 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span className="text-sm font-bold">Filters</span>
          {hasActiveFilters && (
            <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, priceMin: 0, priceMax: 0, stars: [] })}
            className="text-xs font-semibold text-white/90 hover:text-white underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      <div className={cx("space-y-5", isCompact ? "p-4" : "p-5")}>

        {/* Sort */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sort by</div>
          <div className="space-y-1.5">
            {sortOptions.map((o) => {
              const active = filters.sort === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => update({ sort: o.id })}
                  className={cx(
                    "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-orange-50 text-primary shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/40"
                  )}
                >
                  <span className={cx("text-base leading-none", active ? "text-primary" : "text-gray-400")}>
                    {o.icon}
                  </span>
                  {o.label}
                  {active && (
                    <svg className="ml-auto h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Price range */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Price / night</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500 font-medium">Min ₹</label>
              <input
                type="number"
                value={filters.priceMin || ""}
                placeholder={String(Math.floor(stats.min))}
                onChange={(e) => update({ priceMin: clampNumber(Number(e.target.value || 0), 0, 1_000_000) })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 font-medium">Max ₹</label>
              <input
                type="number"
                value={filters.priceMax || ""}
                placeholder={String(Math.ceil(stats.max))}
                onChange={(e) => update({ priceMax: clampNumber(Number(e.target.value || 0), 0, 1_000_000) })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          {stats.min > 0 && (
            <div className="mt-2 text-[11px] text-gray-400">
              Range: {Math.floor(stats.min).toLocaleString()} – {Math.ceil(stats.max).toLocaleString()}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Star rating */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Star rating</div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => {
              const on = filters.stars.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() =>
                    update({
                      stars: on ? filters.stars.filter((x) => x !== s) : [...filters.stars, s].sort(),
                    })
                  }
                  className={cx(
                    "flex flex-col items-center justify-center rounded-xl border py-2 text-xs font-bold transition-all",
                    on
                      ? "border-primary bg-primary text-white shadow-sm shadow-primary/30"
                      : "border-gray-200 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-600"
                  )}
                >
                  <span className="text-sm leading-none">{s}</span>
                  <span className="text-[9px] leading-none mt-0.5">★</span>
                </button>
              );
            })}
          </div>
          {filters.stars.length > 0 && (
            <div className="mt-2 text-[11px] text-orange-600 font-medium">
              {filters.stars.join(", ")}★ selected
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
