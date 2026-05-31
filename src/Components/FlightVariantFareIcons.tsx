"use client";

const ICON_BLUE = "#2563eb";
const OG = "#FC6603";

/** Fixed-width columns so baggage / fare-rule icons align vertically across fare rows (like R). */
const FARE_ROW_GRID = "grid grid-cols-[auto_minmax(0,1fr)_56px_18px_minmax(52px,auto)] items-center gap-x-1.5";

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="p-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
      aria-label={title}
    >
      {children}
    </button>
  );
}

export function CabinBaggageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ICON_BLUE} strokeWidth="1.6">
      <path d="M8 7V6a4 4 0 118 0v1M6 9h12l-1 11H7L6 9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckinBaggageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ICON_BLUE} strokeWidth="1.6">
      <rect x="5" y="9" width="14" height="12" rx="1" />
      <path d="M9 9V7a3 3 0 116 0v2" strokeLinecap="round" />
    </svg>
  );
}

export function FareRulesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ICON_BLUE} strokeWidth="1.6">
      <path d="M7 6h14M7 10h14M7 14h10M7 18h8" strokeLinecap="round" />
      <rect x="3" y="5" width="3" height="14" rx="0.5" fill={ICON_BLUE} fillOpacity="0.25" />
    </svg>
  );
}

function RefundableBadge({ isRefundable }: { isRefundable: boolean }) {
  return (
    <span
      title={isRefundable ? "Refundable" : "Non-Refundable"}
      className="flex justify-center shrink-0"
      style={{ width: 16, height: 16 }}
    >
      <svg viewBox="0 0 18 18" width="16" height="16">
        <circle
          cx="9"
          cy="9"
          r="8"
          fill="none"
          stroke={isRefundable ? "#16a34a" : "#ef4444"}
          strokeWidth="1.5"
        />
        <text
          x="9"
          y="13"
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill={isRefundable ? "#16a34a" : "#ef4444"}
        >
          R
        </text>
        {!isRefundable && (
          <line x1="3" y1="3" x2="15" y2="15" stroke="#ef4444" strokeWidth="1.5" />
        )}
      </svg>
    </span>
  );
}

export function FlightVariantFareIcons({
  onCabinBaggage,
  onCheckinBaggage,
  onFareRules,
  size = "md",
}: {
  variant?: unknown;
  onCabinBaggage: () => void;
  onCheckinBaggage: () => void;
  onFareRules: () => void;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div
      className="flex items-center justify-center gap-0.5 w-full min-w-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <IconButton title="Cabin Baggage (Per Passenger) — sector wise" onClick={onCabinBaggage}>
        <CabinBaggageIcon className={iconClass} />
      </IconButton>
      <IconButton title="Check-in Baggage (Per Passenger) — sector wise" onClick={onCheckinBaggage}>
        <CheckinBaggageIcon className={iconClass} />
      </IconButton>
      <IconButton title="Fare Rules" onClick={onFareRules}>
        <FareRulesIcon className={iconClass} />
      </IconButton>
    </div>
  );
}

export function VariantFareOptionRow({
  isSelected,
  fareLabel,
  variant,
  price,
  isRefundable,
  onSelect,
  onCabinBaggage,
  onCheckinBaggage,
  onFareRules,
  size = "md",
  rowClassName = "",
  primaryColor = OG,
}: {
  isSelected: boolean;
  fareLabel: string;
  variant: unknown;
  price: number | undefined;
  isRefundable: boolean;
  onSelect: () => void;
  onCabinBaggage: () => void;
  onCheckinBaggage: () => void;
  onFareRules: () => void;
  size?: "sm" | "md";
  rowClassName?: string;
  primaryColor?: string;
}) {
  const radioClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const labelClass =
    size === "sm" ? "text-[11px] font-semibold text-gray-900" : "text-xs font-medium text-gray-900";
  const priceClass = size === "sm" ? "text-xs font-bold tabular-nums" : "text-xs font-bold tabular-nums";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`${FARE_ROW_GRID} cursor-pointer ${rowClassName}`}
    >
      <div
        className={`${radioClass} rounded-full border-2 flex-shrink-0 flex items-center justify-center`}
        style={{ borderColor: isSelected ? primaryColor : "#d1d5db" }}
      >
        {isSelected && (
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
        )}
      </div>
      <span className={`${labelClass} truncate min-w-0 pr-1`}>{fareLabel}</span>
      <FlightVariantFareIcons
        variant={variant}
        size={size}
        onCabinBaggage={onCabinBaggage}
        onCheckinBaggage={onCheckinBaggage}
        onFareRules={onFareRules}
      />
      <RefundableBadge isRefundable={isRefundable} />
      <span className={`${priceClass} text-right shrink-0`} style={{ color: primaryColor }}>
        ₹{price != null ? Number(price).toLocaleString() : "—"}
      </span>
    </div>
  );
}
