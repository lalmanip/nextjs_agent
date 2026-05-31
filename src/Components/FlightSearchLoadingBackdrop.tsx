"use client";

import { useEffect, useMemo, useState } from "react";

const LOADING_BG_IMAGE = "/flight-search-loading-bg.png";
const OG = "#FC6603";

/** Same path as progress bar plane in FlightSearchLoading — nose points +X after rotate(90). */
const PLANE_PATH =
  "M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z";
const PLANE_SCALE = 0.14;
const PLANE_CENTER = 12 * PLANE_SCALE;

/** Hub positions (% of map overlay, tuned for flight-search-loading-bg.png) */
const HUBS = [
  { id: "nyc", x: 28, y: 38 },
  { id: "la", x: 15, y: 42 },
  { id: "london", x: 48, y: 34 },
  { id: "dubai", x: 58, y: 48 },
  { id: "mumbai", x: 62, y: 52 },
  { id: "singapore", x: 72, y: 58 },
  { id: "tokyo", x: 82, y: 40 },
  { id: "sydney", x: 85, y: 68 },
  { id: "saopaulo", x: 35, y: 68 },
  { id: "joburg", x: 52, y: 72 },
  { id: "beijing", x: 78, y: 42 },
  { id: "frankfurt", x: 51, y: 36 },
] as const;

const ROUTES = [
  { id: "nyc-lon", d: "M 28 38 Q 38 22 48 34", duration: 5.2 },
  { id: "lon-dxb", d: "M 48 34 Q 52 40 58 48", duration: 4.8 },
  { id: "dxb-sin", d: "M 58 48 Q 65 52 72 58", duration: 5 },
  { id: "la-nrt", d: "M 15 42 Q 48 25 82 40", duration: 6.2 },
  { id: "sin-syd", d: "M 72 58 Q 78 63 85 68", duration: 4.5 },
  { id: "gru-jnb", d: "M 35 68 Q 44 70 52 72", duration: 5.5 },
  { id: "lon-bom", d: "M 48 34 Q 55 42 62 52", duration: 5.8 },
  { id: "bom-sin", d: "M 62 52 Q 67 55 72 58", duration: 4.2 },
] as const;

function hubAnimDelay(id: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 97;
  return ((h + salt * 13) % 80) / 40;
}

function pickRandomHubIds(count: number): string[] {
  const pool = [...HUBS];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}

function TravelPlane({ path, duration }: { path: string; duration: number }) {
  return (
    <g className="flight-loading-travel-plane">
      <animateMotion
        dur={`${duration}s`}
        repeatCount="1"
        path={path}
        rotate="auto"
        calcMode="spline"
        keyTimes="0;1"
        keySplines="0.42 0 0.58 1"
      />
      {/* rotate(90): align nose with path tangent (animateMotion rotate="auto" uses +X) */}
      <g transform={`rotate(90) translate(${-PLANE_CENTER}, ${-PLANE_CENTER})`}>
        <path d={PLANE_PATH} fill={OG} transform={`scale(${PLANE_SCALE})`} />
      </g>
    </g>
  );
}

export default function FlightSearchLoadingBackdrop() {
  const [activeRoute, setActiveRoute] = useState(0);
  const [glowingHubIds, setGlowingHubIds] = useState<string[]>(() =>
    pickRandomHubIds(5)
  );
  const [flightKey, setFlightKey] = useState(0);

  const route = ROUTES[activeRoute];

  useEffect(() => {
    const ms = route.duration * 1000 + 400;
    const timer = setTimeout(() => {
      setActiveRoute((i) => (i + 1) % ROUTES.length);
      setFlightKey((k) => k + 1);
    }, ms);
    return () => clearTimeout(timer);
  }, [activeRoute, route.duration]);

  useEffect(() => {
    const glowTimer = setInterval(() => {
      setGlowingHubIds(pickRandomHubIds(4 + Math.floor(Math.random() * 3)));
    }, 2200);
    return () => clearInterval(glowTimer);
  }, []);

  const staticArcs = useMemo(() => ROUTES.map((r) => r.d), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${LOADING_BG_IMAGE})`,
          animation: "flight-loading-bg-zoom 28s ease-in-out infinite alternate",
        }}
      />

      {/* Ambient corner warmth */}
      <div
        className="absolute -bottom-20 -left-20 h-[45%] w-[45%] rounded-full opacity-60"
        style={{
          background: "radial-gradient(circle, rgba(212,165,90,0.35) 0%, transparent 70%)",
          animation: "flight-loading-ambient-glow 10s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-16 -top-16 h-[40%] w-[40%] rounded-full opacity-50"
        style={{
          background: "radial-gradient(circle, rgba(212,165,90,0.28) 0%, transparent 72%)",
          animation: "flight-loading-ambient-glow 12s ease-in-out infinite 3s",
        }}
      />

      {/* Animated map layer */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="flight-loading-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="flight-loading-route-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(56,189,248,0.15)" />
            <stop offset="50%" stopColor="rgba(56,189,248,0.55)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.15)" />
          </linearGradient>
        </defs>

        {/* Faint global network */}
        {staticArcs.map((d, i) => (
          <path
            key={`net-${i}`}
            d={d}
            fill="none"
            stroke="rgba(56,189,248,0.12)"
            strokeWidth="0.25"
            strokeLinecap="round"
          />
        ))}

        {/* Active route highlight */}
        <path
          d={route.d}
          fill="none"
          stroke="url(#flight-loading-route-grad)"
          strokeWidth="0.45"
          strokeLinecap="round"
          strokeDasharray="3 2"
          className="flight-loading-active-route"
        />

        {/* Hub nodes */}
        {HUBS.map((hub) => {
          const isGlowing = glowingHubIds.includes(hub.id);
          return (
            <g key={hub.id} transform={`translate(${hub.x}, ${hub.y})`}>
              {isGlowing && (
                <>
                  <circle
                    r="2.8"
                    fill="none"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="0.35"
                    className="flight-loading-hub-ring"
                    style={{ animationDelay: `${hubAnimDelay(hub.id, 1)}s` }}
                  />
                  <circle
                    r="1.4"
                    fill="rgba(255,255,255,0.35)"
                    className="flight-loading-hub-flash"
                    style={{ animationDelay: `${hubAnimDelay(hub.id, 2)}s` }}
                  />
                </>
              )}
              <circle
                r="0.55"
                fill="#fff"
                filter="url(#flight-loading-glow)"
                opacity={isGlowing ? 1 : 0.65}
              />
              <circle r="1.2" fill="rgba(56,189,248,0.2)" className="flight-loading-hub-pulse" />
            </g>
          );
        })}

        {/* One flight at a time */}
        <g key={`flight-${flightKey}-${route.id}`}>
          <TravelPlane path={route.d} duration={route.duration} />
        </g>
      </svg>

      {/* Drifting background silhouettes */}
      <div className="absolute inset-0 opacity-[0.14]">
        <div
          className="absolute left-[8%] top-[22%] text-white flight-loading-ghost-plane"
          style={{ animationDuration: "38s", animationDelay: "0s" }}
        >
          ✈
        </div>
        <div
          className="absolute left-[55%] top-[18%] text-white flight-loading-ghost-plane-reverse"
          style={{ animationDuration: "44s", animationDelay: "6s" }}
        >
          ✈
        </div>
        <div
          className="absolute left-[70%] top-[55%] text-white flight-loading-ghost-plane"
          style={{ animationDuration: "52s", animationDelay: "12s", fontSize: "1.25rem" }}
        >
          ✈
        </div>
      </div>

      {/* Center vignette — card sits over empty frame in artwork */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 42% 38% at 50% 50%, rgba(8,18,32,0.55) 0%, rgba(8,18,32,0.2) 55%, transparent 75%)",
        }}
      />
      <div className="absolute inset-0 bg-[#081220]/15" />
    </div>
  );
}
