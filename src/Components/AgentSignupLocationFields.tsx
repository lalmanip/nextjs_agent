"use client";

import type { useSignupStyleLocation } from "@/lib/useSignupStyleLocation";

const selectCls = (hasError: boolean) =>
  `w-full rounded-lg bg-white/10 border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 ${
    hasError ? "border-red-400" : "border-white/20"
  }`;

const labelCls = "block text-xs font-medium text-orange-200 mb-1";

type LocationApi = ReturnType<typeof useSignupStyleLocation>;

type Props = {
  location: LocationApi;
  errors?: { country?: string; state?: string; city?: string };
  onCountryChange?: () => void;
  onStateChange?: () => void;
  onCityChange?: () => void;
};

export default function AgentSignupLocationFields({
  location,
  errors = {},
  onCountryChange,
  onStateChange,
  onCityChange,
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
    hasCityDropdown,
  } = location;

  return (
    <>
      <div>
        <label className={labelCls}>
          Country <span className="text-red-400 ml-0.5">*</span>
        </label>
        <select
          value={countryIso}
          onChange={(e) => {
            setCountryIso(e.target.value);
            onCountryChange?.();
          }}
          disabled={countriesLoading}
          className={selectCls(!!errors.country)}
          aria-invalid={!!errors.country}
        >
          <option value="" className="bg-orange-950 text-white">
            {countriesLoading ? "Loading countries…" : "Select country"}
          </option>
          {[...countryList]
            .sort((a, b) => a.countryName.localeCompare(b.countryName, "en"))
            .map((c) => (
              <option
                key={c.isoCountryCode}
                value={c.isoCountryCode}
                className="bg-orange-950 text-white"
              >
                {c.countryName}
                {c.countryCode ? ` (${c.countryCode})` : ""}
              </option>
            ))}
        </select>
        {errors.country && <p className="mt-1 text-xs text-red-300">{errors.country}</p>}
      </div>

      <div>
        <label className={labelCls}>
          State <span className="text-red-400 ml-0.5">*</span>
        </label>
        <select
          value={stateKey}
          onChange={(e) => {
            setStateKey(e.target.value);
            onStateChange?.();
          }}
          disabled={!countryIso || statesLoading}
          className={selectCls(!!errors.state)}
          aria-invalid={!!errors.state}
        >
          <option value="" className="bg-orange-950 text-white">
            {!countryIso
              ? "Select country first"
              : statesLoading
                ? "Loading states…"
                : stateList.length === 0
                  ? "No states listed"
                  : "Select state"}
          </option>
          {[...stateList]
            .sort((a, b) => a.stateName.localeCompare(b.stateName, "en"))
            .map((s) => {
              const optVal = s.stateOrigin || s.stateCode || s.stateName;
              return (
                <option
                  key={`${s.stateOrigin || "x"}-${s.stateCode}-${s.stateName}`}
                  value={optVal}
                  className="bg-orange-950 text-white"
                >
                  {s.stateName}
                  {s.stateCode && s.stateName !== s.stateCode ? ` (${s.stateCode})` : ""}
                </option>
              );
            })}
        </select>
        {errors.state && <p className="mt-1 text-xs text-red-300">{errors.state}</p>}
      </div>

      <div>
        <label className={labelCls}>
          City <span className="text-red-400 ml-0.5">*</span>
        </label>
        {hasCityDropdown ? (
          <select
            value={cityKey}
            onChange={(e) => {
              setCityKey(e.target.value);
              onCityChange?.();
            }}
            disabled={!stateKey || citiesLoading}
            className={selectCls(!!errors.city)}
            aria-invalid={!!errors.city}
          >
            <option value="" className="bg-orange-950 text-white">
              {!stateKey
                ? "Select state first"
                : citiesLoading
                  ? "Loading cities…"
                  : cityList.length === 0
                    ? "No cities listed"
                    : "Select city"}
            </option>
            {[...cityList]
              .sort((a, b) => a.cityName.localeCompare(b.cityName, "en"))
              .map((c, idx) => {
                const optVal = c.cityCode || c.cityName;
                return (
                  <option
                    key={`city-${idx}-${c.cityCode || ""}-${c.cityName}`}
                    value={optVal}
                    className="bg-orange-950 text-white"
                  >
                    {c.cityName}
                  </option>
                );
              })}
          </select>
        ) : (
          <input
            type="text"
            value={cityManual}
            onChange={(e) => {
              setCityManual(e.target.value);
              onCityChange?.();
            }}
            placeholder={stateKey ? "Enter city" : "Select state first"}
            disabled={!stateKey}
            className={selectCls(!!errors.city)}
            aria-invalid={!!errors.city}
          />
        )}
        {errors.city && <p className="mt-1 text-xs text-red-300">{errors.city}</p>}
      </div>
    </>
  );
}
