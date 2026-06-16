"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  formatTravellerDisplayName,
  formatTravellerTypeaheadSecondary,
  normalizeTravellerMember,
} from "@/lib/travellerFields";
import { travellerMatchesPaxType } from "@/lib/passengerDobRules";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const LIMIT = 10;
const MAX_CACHE_KEYS = 25;

export type SavedTravellerHit = Record<string, unknown>;

export interface PassengerTravellerTypeaheadProps {
  userId: number | string;
  value: string;
  paxType: string;
  travelRefDate: Date;
  onValueChange: (value: string) => void;
  onSelect: (member: SavedTravellerHit) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  accentColor?: string;
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

export default function PassengerTravellerTypeahead({
  userId,
  value,
  paxType,
  travelRefDate,
  onValueChange,
  onSelect,
  disabled,
  placeholder = "Type passenger name",
  maxLength = 50,
  className,
  accentColor = "#f97316",
}: PassengerTravellerTypeaheadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const cacheRef = useRef<Map<string, SavedTravellerHit[]>>(new Map());
  const lastFetchedQueryRef = useRef<string>("");

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SavedTravellerHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedQuery = useMemo(() => value.trim(), [value]);
  const canSearch = normalizedQuery.length >= MIN_CHARS && !!userId;

  const close = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
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

    const cacheKey = `${userId}:${q.toLowerCase()}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setActiveIndex(cached.length ? 0 : -1);
      return;
    }

    if (lastFetchedQueryRef.current === cacheKey) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setError(null);

      try {
        const url = `/api/family-members/search?userId=${encodeURIComponent(String(userId))}&q=${encodeURIComponent(q)}&limit=${LIMIT}`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const payload = await res.json();
        const rows = Array.isArray(payload?.response) ? payload.response : [];
        const filtered = rows
          .map((row: Record<string, unknown>) => normalizeTravellerMember(row))
          .filter((member: SavedTravellerHit) =>
            travellerMatchesPaxType(member, paxType, travelRefDate),
          );

        lastFetchedQueryRef.current = cacheKey;
        cacheRef.current.set(cacheKey, filtered);
        if (cacheRef.current.size > MAX_CACHE_KEYS) {
          const firstKey = cacheRef.current.keys().next().value as string | undefined;
          if (firstKey) cacheRef.current.delete(firstKey);
        }

        setResults(filtered);
        setActiveIndex(filtered.length > 0 ? 0 : -1);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setResults([]);
        setActiveIndex(-1);
        setError("Could not load saved passengers.");
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, [canSearch, isOpen, normalizedQuery, paxType, travelRefDate, userId]);

  const commitSelection = (member: SavedTravellerHit) => {
    const fn = String(member.firstName ?? member.FirstName ?? "").trim();
    onValueChange(fn);
    onSelect(member);
    close();
  };

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
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setActiveIndex((i) => Math.max(i - 1, 0));
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0 && activeIndex < results.length) {
      commitSelection(results[activeIndex]);
      e.preventDefault();
      return;
    }
    if (/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => {
          onValueChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = `0 0 0 2px ${accentColor}33`;
          if (canSearch) setIsOpen(true);
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = "";
        }}
        onKeyDown={onKeyDown}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
        autoComplete="off"
      />

      {showDropdown && (loading || error || results.length > 0 || showNoResults) && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-500">Searching saved passengers…</div>
          )}
          {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
          {showNoResults && (
            <div className="px-3 py-2 text-xs text-gray-500">No matching saved passengers.</div>
          )}
          {results.map((member, idx) => {
            const name = formatTravellerDisplayName(member);
            const secondary = formatTravellerTypeaheadSecondary(member);
            const active = idx === activeIndex;
            return (
              <button
                key={String(member.origin ?? member.Origin ?? idx)}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${active ? "bg-orange-50" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitSelection(member)}
              >
                <div className="font-medium text-gray-800">
                  {highlightMatch(name, normalizedQuery)}
                </div>
                {secondary && <div className="text-[11px] text-gray-500 mt-0.5">{secondary}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
