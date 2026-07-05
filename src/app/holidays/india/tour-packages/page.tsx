import { redirect } from "next/navigation";
import { indiaTourPackagesHref } from "@/lib/indiaTourismNav";

export default function IndiaTourPackagesIndexPage() {
  redirect(indiaTourPackagesHref());
}
