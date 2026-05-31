"use client";

import { useCallback, useEffect, useState } from "react";

export type LocationCountryOption = {
  isoCountryCode: string;
  countryName: string;
  countryCode?: string;
};

export type LocationStateOption = {
  stateName: string;
  stateCode: string;
  stateOrigin: string;
};

export type LocationCityOption = {
  cityName: string;
  cityCode: string;
};

export function useSignupStyleLocation(initialCountryIso = "IN") {
  const [countryIso, setCountryIso] = useState(initialCountryIso);
  const [countryList, setCountryList] = useState<LocationCountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const [stateKey, setStateKey] = useState("");
  const [stateList, setStateList] = useState<LocationStateOption[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);

  const [cityKey, setCityKey] = useState("");
  const [cityManual, setCityManual] = useState("");
  const [cityList, setCityList] = useState<LocationCityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCountriesLoading(true);
    fetch("/api/country-list")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setCountryList(Array.isArray(data) ? (data as LocationCountryOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setCountryList([{ isoCountryCode: "IN", countryName: "India", countryCode: "+91" }]);
        }
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStateKey("");
    setCityKey("");
    setCityManual("");
  }, [countryIso]);

  useEffect(() => {
    setCityKey("");
    setCityManual("");
  }, [stateKey]);

  useEffect(() => {
    const iso = countryIso.trim();
    if (!iso) {
      setStateList([]);
      setStatesLoading(false);
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    setStateList([]);
    fetch(`/api/state-list/${encodeURIComponent(iso)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        setStateList(Array.isArray(data) ? (data as LocationStateOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setStateList([]);
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryIso]);

  const selectedState = stateList.find(
    (s) => (s.stateOrigin || s.stateCode || s.stateName) === stateKey,
  );

  useEffect(() => {
    const origin = selectedState?.stateOrigin?.trim();
    if (!origin) {
      setCityList([]);
      setCitiesLoading(false);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    setCityList([]);
    fetch(`/api/city-list/state/${encodeURIComponent(origin)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        setCityList(Array.isArray(data) ? (data as LocationCityOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setCityList([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateKey, stateList, selectedState?.stateOrigin]);

  const getCountryName = useCallback(() => {
    const iso = countryIso.trim();
    if (!iso) return "";
    return countryList.find((c) => c.isoCountryCode === iso)?.countryName?.trim() || "";
  }, [countryIso, countryList]);

  const getStateName = useCallback(() => {
    if (!stateKey.trim()) return "";
    return selectedState?.stateName?.trim() || stateKey.trim();
  }, [stateKey, selectedState]);

  const getCityName = useCallback(() => {
    const origin = selectedState?.stateOrigin?.trim();
    if (origin) {
      if (!cityKey.trim()) return "";
      const row = cityList.find(
        (c) => c.cityName === cityKey || (c.cityCode && c.cityCode === cityKey),
      );
      return row?.cityName?.trim() || cityKey.trim();
    }
    if (stateKey.trim()) return cityManual.trim();
    return "";
  }, [selectedState, cityKey, cityList, cityManual, stateKey]);

  const hasCityDropdown = !!selectedState?.stateOrigin?.trim();

  return {
    countryIso,
    setCountryIso,
    countryList,
    countriesLoading,
    stateKey,
    setStateKey,
    stateList,
    statesLoading,
    cityKey,
    setCityKey,
    cityManual,
    setCityManual,
    cityList,
    citiesLoading,
    selectedState,
    hasCityDropdown,
    getCountryName,
    getStateName,
    getCityName,
  };
}
