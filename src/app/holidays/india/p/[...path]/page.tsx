import { notFound } from "next/navigation";
import IndiaLocationDetailView from "@/Components/india-tourism/IndiaLocationDetailView";
import { getExtraPageDetail, listExtraPagePaths } from "@/lib/indiaTourismContent";

export function generateStaticParams() {
  return listExtraPagePaths().map((path) => ({ path }));
}

export default function IndiaExtraPage({ params }: { params: { path: string[] } }) {
  const detail = getExtraPageDetail(params.path ?? []);
  if (!detail) notFound();

  const breadcrumb = [
    { label: "Home", href: "/holidays/india" },
    ...(detail.breadcrumb ?? [{ label: detail.breadcrumbLabel }]),
  ];

  return (
    <IndiaLocationDetailView
      title={detail.title}
      imageUrl={detail.imageUrl}
      description={detail.description}
      sections={detail.sections}
      breadcrumb={breadcrumb}
      siblingNav={detail.siblingNav}
      currentPath={detail.path}
    />
  );
}
