import { notFound } from "next/navigation";
import IndiaTourPackagesView from "@/Components/india-tourism/IndiaTourPackagesView";
import {
  getTourPackagePageData,
  listTourPackageSubTabParams,
} from "@/lib/indiaTourPackages";

export function generateStaticParams() {
  return listTourPackageSubTabParams();
}

export function generateMetadata({
  params,
}: {
  params: { category: string; subTab: string };
}) {
  const page = getTourPackagePageData(params.category, params.subTab);
  if (!page) return { title: "Tour Packages" };
  return {
    title: page.categoryTitle,
    description: page.intro[0] ?? undefined,
  };
}

export default function IndiaTourPackageSubTabPage({
  params,
}: {
  params: { category: string; subTab: string };
}) {
  const page = getTourPackagePageData(params.category, params.subTab);
  if (!page) notFound();

  return <IndiaTourPackagesView {...page} />;
}
