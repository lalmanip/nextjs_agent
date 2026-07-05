import { notFound } from "next/navigation";
import IndiaTourPackagesView from "@/Components/india-tourism/IndiaTourPackagesView";
import {
  getTourPackagePageData,
  listTourPackageCategorySlugs,
} from "@/lib/indiaTourPackages";

export function generateStaticParams() {
  return listTourPackageCategorySlugs().map((category) => ({ category }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const page = getTourPackagePageData(params.category);
  if (!page) return { title: "Tour Packages" };
  return {
    title: page.categoryTitle,
    description: page.intro[0] ?? undefined,
  };
}

export default function IndiaTourPackageCategoryPage({ params }: { params: { category: string } }) {
  const page = getTourPackagePageData(params.category);
  if (!page) notFound();

  return <IndiaTourPackagesView {...page} />;
}
