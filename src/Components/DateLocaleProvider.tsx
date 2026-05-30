"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  detectDateLocale,
  formatUserCalendarDateUtc,
  formatUserDate,
  formatUserDateNumeric,
  getDateFormatHint,
  getDateInputLang,
  getDateLocale,
  setDateLocale,
} from "@/lib/dateLocale";

type DateLocaleContextValue = {
  locale: string;
  inputLang: string;
  formatHint: string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateNumeric: (value: string | Date) => string;
  formatCalendarDateUtc: (isoOrYmd: string, options?: Intl.DateTimeFormatOptions) => string;
};

const DateLocaleContext = createContext<DateLocaleContextValue | null>(null);

export function DateLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(DEFAULT_FALLBACK);

  useEffect(() => {
    const detected = detectDateLocale();
    setLocale(detected);
    setDateLocale(detected);
  }, []);

  const value = useMemo<DateLocaleContextValue>(
    () => ({
      locale,
      inputLang: getDateInputLang(locale),
      formatHint: getDateFormatHint(locale),
      formatDate: (v, opts) => formatUserDate(v, opts, locale),
      formatDateNumeric: (v) => formatUserDateNumeric(v, locale),
      formatCalendarDateUtc: (ymd, opts) => formatUserCalendarDateUtc(ymd, opts, locale),
    }),
    [locale],
  );

  return <DateLocaleContext.Provider value={value}>{children}</DateLocaleContext.Provider>;
}

const DEFAULT_FALLBACK = "en-IN";

export function useDateLocale(): DateLocaleContextValue {
  const ctx = useContext(DateLocaleContext);
  if (ctx) return ctx;
  const locale = typeof window !== "undefined" ? getDateLocale() : DEFAULT_FALLBACK;
  return {
    locale,
    inputLang: getDateInputLang(locale),
    formatHint: getDateFormatHint(locale),
    formatDate: (v, opts) => formatUserDate(v, opts, locale),
    formatDateNumeric: (v) => formatUserDateNumeric(v, locale),
    formatCalendarDateUtc: (ymd, opts) => formatUserCalendarDateUtc(ymd, opts, locale),
  };
}
