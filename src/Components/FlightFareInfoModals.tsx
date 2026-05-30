"use client";

import type { ReactNode } from "react";
import {
  formatMiniFareRuleWindow,
  getMiniFareRulesByJourney,
  getSectorBaggageRows,
  groupMiniFareRulesForDisplay,
  type MiniFareRuleRow,
} from "@/lib/flightSearchAttr";

const MODAL_BLUE = "#1e3a8a";

function RuleLines({ rules }: { rules: MiniFareRuleRow[] }) {
  if (!rules.length) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <ul className="space-y-2 text-xs text-gray-800">
      {rules.map((r, i) => {
        const window = formatMiniFareRuleWindow(r.from, r.to, r.unit);
        return (
          <li key={i} className="leading-snug">
            <span className="font-semibold">{r.details}</span>
            {window ? <span className="text-gray-600"> {window}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function ModalShell({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fare-info-modal-title"
      >
        <div
          className="flex items-center justify-between px-4 py-3 text-white shrink-0"
          style={{ backgroundColor: MODAL_BLUE }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h2 id="fare-info-modal-title" className="font-bold text-sm sm:text-base truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
        <div className="p-4 border-t shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-white font-semibold text-sm"
            style={{ backgroundColor: MODAL_BLUE }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CabinBaggageModal({
  variant,
  fareLabel,
  onClose,
}: {
  variant: unknown;
  fareLabel?: string;
  onClose: () => void;
}) {
  const rows = getSectorBaggageRows(variant, "cabin");
  return (
    <ModalShell
      title="Cabin Baggage (Per Passenger)"
      onClose={onClose}
      icon={
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 8V6a4 4 0 118 0v2M6 8h12l-1 12H7L6 8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      {fareLabel ? (
        <p className="text-xs text-gray-500 mb-3">
          Fare: <span className="font-semibold text-gray-800">{fareLabel}</span>
        </p>
      ) : null}
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-sky-50 text-left">
            <th className="px-3 py-2 font-semibold text-gray-800 border-b">Sector</th>
            <th className="px-3 py-2 font-semibold text-gray-800 border-b">Cabin Baggage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-b-0">
              <td className="px-3 py-2 font-medium text-gray-900">{r.sector}</td>
              <td className="px-3 py-2 text-gray-700">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

export function CheckinBaggageModal({
  variant,
  fareLabel,
  onClose,
}: {
  variant: unknown;
  fareLabel?: string;
  onClose: () => void;
}) {
  const rows = getSectorBaggageRows(variant, "checkin");
  return (
    <ModalShell
      title="Check-in Baggage (Per Passenger)"
      onClose={onClose}
      icon={
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="8" width="14" height="13" rx="1" />
          <path d="M9 8V6a3 3 0 116 0v2" strokeLinecap="round" />
        </svg>
      }
    >
      {fareLabel ? (
        <p className="text-xs text-gray-500 mb-3">
          Fare: <span className="font-semibold text-gray-800">{fareLabel}</span>
        </p>
      ) : null}
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-sky-50 text-left">
            <th className="px-3 py-2 font-semibold text-gray-800 border-b">Sector</th>
            <th className="px-3 py-2 font-semibold text-gray-800 border-b">Check-in Baggage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-b-0">
              <td className="px-3 py-2 font-medium text-gray-900">{r.sector}</td>
              <td className="px-3 py-2 text-gray-700">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

export function FareRulesModal({
  variant,
  fareLabel,
  onClose,
}: {
  variant: unknown;
  fareLabel?: string;
  onClose: () => void;
}) {
  const grouped = groupMiniFareRulesForDisplay(getMiniFareRulesByJourney(variant));

  return (
    <ModalShell
      title="Fare Rules"
      onClose={onClose}
      icon={
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 6h12M8 10h12M8 14h8M8 18h6" strokeLinecap="round" />
          <rect x="4" y="4" width="4" height="16" rx="0.5" fill="currentColor" opacity="0.3" />
        </svg>
      }
    >
      {fareLabel ? (
        <p className="text-xs text-gray-500 mb-3">
          Fare: <span className="font-semibold text-gray-800">{fareLabel}</span>
        </p>
      ) : null}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-600">Fare rules are not available for this fare.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.sector} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 text-xs font-bold text-gray-800 bg-sky-50 border-b">
                {g.sector}
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-200">
                <div className="p-3">
                  <div className="text-xs font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    Cancellation
                  </div>
                  <RuleLines rules={g.cancellation} />
                </div>
                <div className="p-3">
                  <div className="text-xs font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    Reissue
                  </div>
                  <RuleLines rules={g.reissue} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 p-3 text-[11px] text-red-900 leading-relaxed">
        <div className="font-bold text-red-700 mb-1">⚠️ Important:-</div>
        <ul className="list-disc pl-4 space-y-1">
          <li>*FEES ARE INDICATIVE PER PAX AND PER SECTOR.</li>
          <li>GST, RAF AND ANY OTHER APPLICABLE CHARGES ARE EXTRA.</li>
          <li>
            FOR DOMESTIC BOOKINGS, PASSENGERS MUST SUBMIT THE CANCELLATION OR REISSUE REQUEST AT
            LEAST 2 HOURS BEFORE THE TIME LIMIT DEFINED IN THE AIRLINE&apos;S POLICY.
          </li>
          <li>
            FOR INTERNATIONAL BOOKINGS, PASSENGERS MUST SUBMIT THE CANCELLATION OR REISSUE REQUEST
            AT LEAST 4 HOURS BEFORE THE TIME LIMIT DEFINED IN THE AIRLINE&apos;S POLICY.
          </li>
        </ul>
      </div>
    </ModalShell>
  );
}
