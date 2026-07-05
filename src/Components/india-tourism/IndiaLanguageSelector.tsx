"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getActiveIndiaTourismLanguage,
  INDIA_TOURISM_LANGUAGES,
  setIndiaTourismLanguage,
} from "@/lib/indiaTourismLanguages";

export default function IndiaLanguageSelector() {
  const [open, setOpen] = useState(false);
  const [activeCode, setActiveCode] = useState("en");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveCode(getActiveIndiaTourismLanguage());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current =
    INDIA_TOURISM_LANGUAGES.find((lang) => lang.googleCode === activeCode) ??
    INDIA_TOURISM_LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-sm text-gray-700 transition hover:text-primary"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" />
        {current.label}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute right-0 top-full z-[60] mt-2 max-h-72 w-44 overflow-y-auto rounded-lg border border-gray-100 bg-white py-2 shadow-lg"
        >
          {INDIA_TOURISM_LANGUAGES.map((lang) => {
            const isActive = lang.googleCode === activeCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setOpen(false);
                  if (lang.googleCode !== activeCode) {
                    setIndiaTourismLanguage(lang.googleCode);
                  }
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 hover:text-primary ${
                  isActive ? "font-semibold text-primary" : "text-gray-700"
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
