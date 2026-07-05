import { notFound } from "next/navigation";
import IndiaLocationDetailView from "@/Components/india-tourism/IndiaLocationDetailView";
import { getStateDetail } from "@/lib/indiaTourismContent";
import { INDIA_STATES } from "@/lib/indiaTourismNav";

export function generateStaticParams() {
  return INDIA_STATES.map((item) => ({ slug: item.slug }));
}

export default function IndiaStatePage({ params }: { params: { slug: string } }) {
  const detail = getStateDetail(params.slug);
  if (!detail) notFound();

  return (
    <IndiaLocationDetailView
      title={detail.title}
      imageUrl={detail.imageUrl}
      description={detail.description}
      sections={detail.sections}
      breadcrumb={[
        { label: "Home", href: "/holidays/india" },
        { label: "States In India", href: "/holidays/india/experiences/states-in-india" },
        { label: detail.breadcrumbLabel },
      ]}
    />
  );
}