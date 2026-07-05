import { notFound } from "next/navigation";
import IndiaLocationDetailView from "@/Components/india-tourism/IndiaLocationDetailView";
import { getRegionDetail } from "@/lib/indiaTourismContent";
import { INDIA_REGIONS } from "@/lib/indiaTourismNav";

export function generateStaticParams() {
  return INDIA_REGIONS.map((item) => ({ slug: item.slug }));
}

export default function IndiaRegionPage({ params }: { params: { slug: string } }) {
  const detail = getRegionDetail(params.slug);
  if (!detail) notFound();

  return (
    <IndiaLocationDetailView
      title={detail.title}
      imageUrl={detail.imageUrl}
      description={detail.description}
      sections={detail.sections}
      breadcrumb={[
        { label: "Home", href: "/holidays/india" },
        { label: detail.breadcrumbLabel },
      ]}
    />
  );
}