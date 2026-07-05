export type IndiaTourismLanguage = {
  code: string;
  googleCode: string;
  label: string;
};

/** Languages offered on India tourism pages (matches Google Translate codes). */
export const INDIA_TOURISM_LANGUAGES: IndiaTourismLanguage[] = [
  { code: "en", googleCode: "en", label: "EN" },
  { code: "hi", googleCode: "hi", label: "Hindi" },
  { code: "fr", googleCode: "fr", label: "French" },
  { code: "de", googleCode: "de", label: "German" },
  { code: "es", googleCode: "es", label: "Spanish" },
  { code: "it", googleCode: "it", label: "Italian" },
  { code: "ja", googleCode: "ja", label: "Japanese" },
  { code: "zh-CN", googleCode: "zh-CN", label: "Chinese" },
  { code: "ru", googleCode: "ru", label: "Russian" },
  { code: "ar", googleCode: "ar", label: "Arabic" },
];

export const INDIA_LANG_COOKIE = "googtrans";

export function getActiveIndiaTourismLanguage(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  const code = match?.[1];
  if (!code || code === "en") return "en";
  return decodeURIComponent(code);
}

export function setIndiaTourismLanguage(googleCode: string) {
  const value = googleCode === "en" ? "/en/en" : `/en/${googleCode}`;
  const cookiePath = "/holidays/india";

  document.cookie = `${INDIA_LANG_COOKIE}=;path=${cookiePath};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `${INDIA_LANG_COOKIE}=${value};path=${cookiePath}`;

  window.location.reload();
}
