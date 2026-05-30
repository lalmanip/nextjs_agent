"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type LocationSearchItemType = "city" | "hotel";

export interface LocationSearchApiItem {
  type: LocationSearchItemType;
  id: number | string;
  name: string;
  secondaryText: string;
}

function normalizeLocationsResponse(payload: any): LocationSearchApiItem[] {
  // Supports:
  // - plain array (preferred)
  // - { data: [...] }
  // - { success: true, data: [...] }
  const raw =
    Array.isArray(payload) ? payload :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.data?.data) ? payload.data.data :
    [];

  return raw
    .map((x: any) => ({
      type: x?.type === "city" ? "city" : "hotel",
      id: x?.id,
      name: String(x?.name || ""),
      secondaryText: String(x?.secondaryText || ""),
    }))
    .filter((x: LocationSearchApiItem) => !!x.name && (x.type === "city" || x.type === "hotel"));
}

export interface LocationSearchSelected {
  type: LocationSearchItemType;
  id: number | string;
  name: string;
}

export interface LocationSearchInputProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  initialSelected?: LocationSearchSelected | null;
  onSelect?: (selected: LocationSearchSelected | null) => void;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const LIMIT = 15;
const MAX_CACHE_KEYS = 25;

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, idx) => {
    const isMatch = part.toLowerCase() === q.toLowerCase();
    return isMatch ? (
      <strong key={idx} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    );
  });
}

function typeLabel(t: LocationSearchItemType) {
  return t === "city" ? "City" : "Hotel";
}

export function LocationSearchInput({
  placeholder = "Enter City or Hotel Name",
  disabled,
  className,
  inputClassName,
  dropdownClassName,
  initialSelected = null,
  onSelect,
}: LocationSearchInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const cacheRef = useRef<Map<string, LocationSearchApiItem[]>>(new Map());
  const lastFetchedQueryRef = useRef<string>("");

  const [inputValue, setInputValue] = useState(initialSelected?.name ?? "");
  const [selected, setSelected] = useState<LocationSearchSelected | null>(initialSelected);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationSearchApiItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const normalizedQuery = useMemo(() => inputValue.trim(), [inputValue]);
  const canSearch = normalizedQuery.length >= MIN_CHARS;

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const open = () => {
    if (!disabled) setIsOpen(true);
  };

  const clear = () => {
    abortRef.current?.abort();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setInputValue("");
    setSelected(null);
    setResults([]);
    setError(null);
    setLoading(false);
    setActiveIndex(-1);
    setIsOpen(false);
    onSelect?.(null);
    inputRef.current?.focus();
  };

  const commitSelection = (item: LocationSearchApiItem) => {
    const sel: LocationSearchSelected = { type: item.type, id: item.id, name: item.name };
    setSelected(sel);
    setInputValue(item.name);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect?.(sel);
  };

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    const q = normalizedQuery;
    if (!canSearch) {
      abortRef.current?.abort();
      setLoading(false);
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    if (selected && selected.name === q) {
      setLoading(false);
      setResults([]);
      return;
    }

    const cached = cacheRef.current.get(q.toLowerCase());
    if (cached) {
      setResults(cached);
      setLoading(false);
      setActiveIndex(cached.length ? 0 : -1);
      return;
    }

    if (lastFetchedQueryRef.current === q) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setError(null);

      try {
        const url = `/api/hotels/locations?query=${encodeURIComponent(q)}&limit=${LIMIT}`;
        // Server route logs (route.ts) go to the Node process (e.g. kubectl logs), not here.
        // This only runs in the browser — use it to confirm the exact URL the UI calls.
        if (
          process.env.NODE_ENV === "development" ||
          process.env.NEXT_PUBLIC_DEBUG_HOTEL_LOCATIONS === "1"
        ) {
          console.log("[hotel locations typeahead]", url);
        }
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const payload = await res.json();
        const data: LocationSearchApiItem[] = normalizeLocationsResponse(payload);

        lastFetchedQueryRef.current = q;

        const key = q.toLowerCase();
        cacheRef.current.set(key, data);
        if (cacheRef.current.size > MAX_CACHE_KEYS) {
          const firstKey = cacheRef.current.keys().next().value as string | undefined;
          if (firstKey) cacheRef.current.delete(firstKey);
        }

        setResults(data);
        setActiveIndex(data.length > 0 ? 0 : -1);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setResults([]);
        setActiveIndex(-1);
        setError("Could not load results. Please try again.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, [canSearch, isOpen, normalizedQuery, selected]);

  const showDropdown = isOpen && !disabled;
  const showNoResults = showDropdown && !loading && !error && canSearch && results.length === 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "ArrowDown" && results.length) {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Escape") {
      close();
      e.preventDefault();
      return;
    }

    if (e.key === "ArrowDown") {
      setActiveIndex((i) => {
        const next = Math.min(i + 1, results.length - 1);
        return Number.isFinite(next) ? next : -1;
      });
      e.preventDefault();
      return;
    }

    if (e.key === "ArrowUp") {
      setActiveIndex((i) => Math.max(i - 1, 0));
      e.preventDefault();
      return;
    }

    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        commitSelection(results[activeIndex]);
        e.preventDefault();
      }
    }
  };

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => open()}
          onChange={(e) => {
            const next = e.target.value;
            setInputValue(next);
            if (selected) {
              setSelected(null);
              onSelect?.(null);
            }
            setIsOpen(true);
            setActiveIndex(-1);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="location-search-listbox"
          className={cx(
            "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-20 text-sm text-gray-900 shadow-sm",
            "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            disabled && "bg-gray-100 text-gray-500 cursor-not-allowed",
            inputClassName
          )}
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {loading && (
            <Spinner className="h-5 w-5 text-gray-400 animate-spin" />
          )}
          {!!inputValue && !disabled && (
            <button
              type="button"
              onClick={clear}
              className={cx(
                "ml-1 rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100",
                "focus:outline-none focus:ring-2 focus:ring-primary/30"
              )}
              aria-label="Clear location"
              title="Clear"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showDropdown && (
        <div
          id="location-search-listbox"
          role="listbox"
          className={cx(
            "absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg",
            dropdownClassName
          )}
        >
          {!canSearch && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least {MIN_CHARS} characters to search.
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {canSearch && results.length > 0 && (
            <ul className="max-h-72 overflow-auto py-1">
              {results.map((item, idx) => {
                const active = idx === activeIndex;
                return (
                  <li
                    key={`${item.type}-${String(item.id)}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitSelection(item)}
                    className={cx(
                      "flex cursor-pointer items-start justify-between gap-3 px-4 py-2.5",
                      active ? "bg-orange-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-gray-900">
                        {highlightMatch(item.name, normalizedQuery)}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {highlightMatch(item.secondaryText, normalizedQuery)}
                      </div>
                    </div>

                    <span
                      className={cx(
                        "mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        item.type === "city"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {typeLabel(item.type)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {showNoResults && (
            <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

