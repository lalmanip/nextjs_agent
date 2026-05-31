"use client";

import {
  Binoculars,
  Car,
  CircleCheck,
  Headset,
  Luggage,
  Plane,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const INCLUSION_ICONS: { match: RegExp; Icon: LucideIcon }[] = [
  { match: /^flights?$/i, Icon: Plane },
  { match: /flight/i, Icon: Plane },
  { match: /^hotels?$/i, Icon: Luggage },
  { match: /hotel|accommodation|stay/i, Icon: Luggage },
  { match: /^visa$/i, Icon: Ticket },
  { match: /visa|passport/i, Icon: Ticket },
  { match: /^meals?$/i, Icon: UtensilsCrossed },
  { match: /meal|breakfast|dinner|lunch/i, Icon: UtensilsCrossed },
  { match: /^sightseeing$/i, Icon: Binoculars },
  { match: /sightseeing|tour|excursion/i, Icon: Binoculars },
  { match: /^transfers?$/i, Icon: Car },
  { match: /transfer|pickup|airport/i, Icon: Car },
  { match: /^manager$/i, Icon: Headset },
  { match: /manager|guide|assistance/i, Icon: Headset },
];

function inclusionIcon(label: string): LucideIcon {
  const trimmed = label.trim();
  for (const entry of INCLUSION_ICONS) {
    if (entry.match.test(trimmed)) return entry.Icon;
  }
  return CircleCheck;
}

export default function PackageInclusionHover({
  inclusions,
}: {
  inclusions: string[];
}) {
  if (!inclusions.length) return null;

  return (
    <div className="absolute inset-0 z-[1] flex translate-y-full flex-col justify-end bg-black/80 p-4 pb-5 text-white transition-transform duration-300 group-hover:translate-y-0">
      <div className="border-t border-white/25 pt-4">
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
          {inclusions.map((item) => {
            const Icon = inclusionIcon(item);
            return (
              <div key={item} className="flex flex-col items-center gap-2 text-center">
                <Icon className="h-7 w-7 shrink-0" strokeWidth={1.6} aria-hidden />
                <span className="text-[11px] font-medium leading-tight text-white/95">
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 border-t border-white/25" aria-hidden />
    </div>
  );
}
