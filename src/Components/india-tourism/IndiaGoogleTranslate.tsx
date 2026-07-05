"use client";

import Script from "next/script";

/** Loads Google Translate for India tourism pages (same approach as the reference site). */
export default function IndiaGoogleTranslate() {
  return (
    <>
      <div id="google_translate_element" className="sr-only" aria-hidden="true" />
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          function googleTranslateElementInit() {
            if (!window.google?.translate?.TranslateElement) return;
            new google.translate.TranslateElement(
              { pageLanguage: "en", autoDisplay: false },
              "google_translate_element"
            );
          }
        `}
      </Script>
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}
