"use client";

import type { useSignupStyleLocation } from "@/lib/useSignupStyleLocation";

const OG = "#FC6603";

type LocationApi = ReturnType<typeof useSignupStyleLocation>;

type Props = {
  location: LocationApi;
  inputClassName?: string;
  labelClassName?: string;
};

export default function SignupStyleLocationFields({
  location,
  inputClassName = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none",
  labelClassName = "block text-xs font-semibold text-gray-600 mb-1",
}: Props) {
  const {
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
  } = location;

  const focus = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = `0 0 0 2px ${OG}33`;
  };
  const blur = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = "";
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClassName}>Country *</label>
        <select
          value={countryIso}
          onChange={(e) => setCountryIso(e.target.value)}
          disabled={countriesLoading}
          className={`${inputClassName} disabled:bg-gray-100`}
          onFocus={focus}
          onBlur={blur}
        >
          <option value="">{countriesLoading ? "Loading countries…" : "—"}</option>
          {[...countryList]
            .sort((a, b) => a.countryName.localeCompare(b.countryName, "en"))
            .map((c) => (
              <option key={c.isoCountryCode} value={c.isoCountryCode}>
                {c.countryName}
                {c.countryCode ? ` (${c.countryCode})` : ""}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className={labelClassName}>State / province *</label>
        <select
          value={stateKey}
          onChange={(e) => setStateKey(e.target.value)}
          disabled={!countryIso || statesLoading}
          className={`${inputClassName} disabled:bg-gray-100`}
          onFocus={focus}
          onBlur={blur}
        >
          <option value="">
            {!countryIso
              ? "Select country first"
              : statesLoading
                ? "Loading states…"
                : stateList.length === 0
                  ? "No states listed"
                  : "—"}
          </option>
          {[...stateList]
            .sort((a, b) => a.stateName.localeCompare(b.stateName, "en"))
            .map((s) => {
              const optVal = s.stateOrigin || s.stateCode || s.stateName;
              return (
                <option key={`${s.stateOrigin || "x"}-${s.stateCode}-${s.stateName}`} value={optVal}>
                  {s.stateName}
                  {s.stateCode && s.stateName !== s.stateCode ? ` (${s.stateCode})` : ""}
                </option>
              );
            })}
        </select>
      </div>

      <div>
        <label className={labelClassName}>City *</label>
        {hasCityDropdown ? (
          <select
            value={cityKey}
            onChange={(e) => setCityKey(e.target.value)}
            disabled={!stateKey || citiesLoading}
            className={`${inputClassName} disabled:bg-gray-100`}
            onFocus={focus}
            onBlur={blur}
          >
            <option value="">
              {!stateKey
                ? "Select state first"
                : citiesLoading
                  ? "Loading cities…"
                  : cityList.length === 0
                    ? "No cities listed"
                    : "—"}
            </option>
            {[...cityList]
              .sort((a, b) => a.cityName.localeCompare(b.cityName, "en"))
              .map((c, idx) => (
                <option key={`city-${idx}-${c.cityCode || ""}-${c.cityName}`} value={c.cityName}>
                  {c.cityName}
                </option>
              ))}
          </select>
        ) : (
          <input
            type="text"
            value={cityManual}
            onChange={(e) => setCityManual(e.target.value)}
            placeholder={stateKey ? "City" : "Select state first"}
            disabled={!stateKey}
            autoComplete="address-level2"
            className={inputClassName}
            onFocus={focus}
            onBlur={blur}
          />
        )}
      </div>
    </div>
  );
}
