/** Title → implied gender (flight booking / signup). Mstr/Miss are for child & infant passengers. */
export function getFixedGenderForTitle(title: string | undefined): "Male" | "Female" | null {
  const t = String(title || "").trim();
  if (t === "Mr" || t === "Mstr") return "Male";
  if (t === "Ms" || t === "Mrs" || t === "Miss") return "Female";
  return null;
}
