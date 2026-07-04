type EnvRibbonProps = {
  label: string;
};

/** Sticky banner so Dev/staging is obvious vs production. Controlled by pod env (see envRibbon.ts). */
export default function EnvRibbon({ label }: EnvRibbonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="sticky top-0 z-[100] w-full bg-sky-200 text-sky-950 text-center text-xs sm:text-sm font-semibold tracking-wide py-1.5 px-3 shadow-sm border-b border-sky-400/50"
    >
      {label}
    </div>
  );
}
