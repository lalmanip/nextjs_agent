import { notFound } from "next/navigation";
import IndiaLocationDetailView from "@/Components/india-tourism/IndiaLocationDetailView";
import { getExperienceDetail } from "@/lib/indiaTourismContent";
import { INDIA_EXPERIENCES } from "@/lib/indiaTourismNav";

export function generateStaticParams() {
  return INDIA_EXPERIENCES.map((item) => ({ slug: item.slug }));
}

export default function IndiaExperiencePage({ params }: { params: { slug: string } }) {
  const detail = getExperienceDetail(params.slug);
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