"use client";

import { useDateLocale } from "@/Components/DateLocaleProvider";

type LocaleDateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showFormatHint?: boolean;
};

/** Native date input with `lang` set so display follows user region (dd/mm vs mm/dd). */
export default function LocaleDateInput({
  showFormatHint = false,
  className = "",
  ...props
}: LocaleDateInputProps) {
  const { inputLang, formatHint } = useDateLocale();

  return (
    <div className={showFormatHint ? "flex flex-col gap-0.5" : undefined}>
      <input type="date" lang={inputLang} className={className} {...props} />
      {showFormatHint && (
        <span className="text-[10px] text-gray-400" aria-hidden>
          {formatHint}
        </span>
      )}
    </div>
  );
}
