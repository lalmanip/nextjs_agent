import Link from "next/link";
import type {
  IndiaTourCategoryTab,
  IndiaTourPackageListing,
  IndiaTourPackageSubTab,
} from "@/lib/indiaTourismNav";
import { indiaTourPackagesHref, indiaTourPackagesSubHref } from "@/lib/indiaTourismNav";
import IndiaTourQuoteSidebar from "./IndiaTourQuoteSidebar";
import IndiaTourismHeader from "./IndiaTourismHeader";
import Footer from "@/Components/Footer";

type IndiaTourPackagesViewProps = {
  hubTitle: string;
  categorySlug: string;
  categoryTitle: string;
  intro: string[];
  tabs: IndiaTourCategoryTab[];
  packages: IndiaTourPackageListing[];
  subTabs?: IndiaTourPackageSubTab[];
  activeSubTabSlug?: string;
  categorySourcePath: string;
};

function CategoryTabs({ tabs, activeSlug }: { tabs: IndiaTourCategoryTab[]; activeSlug: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tabs.map((tab) => {
        const isActive = tab.slug === activeSlug;
        const displayLabel =
          tab.shortLabel && !tab.label.includes(tab.shortLabel)
            ? `${tab.label} ${tab.shortLabel}`.trim()
            : tab.label;
        return (
          <Link
            key={tab.slug}
            href={indiaTourPackagesHref(tab.slug)}
            className={`rounded-lg border px-4 py-3 text-center text-sm font-semibold transition ${
              isActive
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-800 hover:border-primary hover:text-primary"
            }`}
          >
            {displayLabel}
          </Link>
        );
      })}
    </div>
  );
}

function SubTabNav({
  subTabs,
  categorySlug,
  categorySourcePath,
  activeSubTabSlug,
}: {
  subTabs: IndiaTourPackageSubTab[];
  categorySlug: string;
  categorySourcePath: string;
  activeSubTabSlug?: string;
}) {
  return (
    <div className="mb-8 overflow-hidden rounded-lg bg-[#1a2744]">
      <div className="flex flex-wrap items-center justify-center gap-1 px-2 py-2 text-sm">
        {subTabs.map((subTab) => {
          const isActive = activeSubTabSlug === subTab.slug;
          const href =
            subTab.sourcePath === categorySourcePath
              ? indiaTourPackagesHref(categorySlug)
              : indiaTourPackagesSubHref(categorySlug, subTab.slug);
          return (
            <Link
              key={subTab.slug}
              href={href}
              className={`rounded px-3 py-2 font-medium transition ${
                isActive ? "bg-emerald-600 text-white" : "text-white hover:bg-white/10"
              }`}
            >
              {subTab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PackageListingCard({ pkg }: { pkg: IndiaTourPackageListing }) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <Link href={pkg.detailsHref}>
        <img src={pkg.imageUrl} alt={pkg.title} className="aspect-[4/3] w-full object-cover" />
      </Link>
      <div className="space-y-2 p-4">
        <Link
          href={pkg.detailsHref}
          className="block text-base font-bold text-[#1a2744] hover:text-primary"
        >
          {pkg.title}
        </Link>
        {pkg.duration ? <p className="text-sm font-semibold text-gray-700">{pkg.duration}</p> : null}
        {pkg.itinerary ? (
          <p className="text-sm leading-relaxed text-gray-600">{pkg.itinerary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href={pkg.detailsHref}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            View Details
          </Link>
          <Link href="#tour-quote-form" className="text-sm font-medium text-primary hover:underline">
            Get a Quote →
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function IndiaTourPackagesView({
  hubTitle,
  categorySlug,
  categoryTitle,
  intro,
  tabs,
  packages,
  subTabs,
  activeSubTabSlug,
  categorySourcePath,
}: IndiaTourPackagesViewProps) {
  return (
    <>
      <IndiaTourismHeader />

      <section className="bg-[#1a2744] py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">{hubTitle}</h1>
        <nav className="mt-3 text-sm text-white/80" aria-label="Breadcrumb">
          <Link href="/holidays/india" className="hover:text-white">
            Home
          </Link>
          <span className="mx-2">&gt;</span>
          <span>{hubTitle}</span>
        </nav>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            {intro.length > 0 ? (
              <div className="mb-8 space-y-4 text-gray-700">
                {intro.map((text, i) => (
                  <p key={i} className="leading-relaxed">
                    {text}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mb-8">
              <CategoryTabs tabs={tabs} activeSlug={categorySlug} />
            </div>

            {subTabs && subTabs.length > 0 ? (
              <SubTabNav
                subTabs={subTabs}
                categorySlug={categorySlug}
                categorySourcePath={categorySourcePath}
                activeSubTabSlug={activeSubTabSlug}
              />
            ) : null}

            {categoryTitle !== hubTitle ? (
              <h2 className="mb-6 text-xl font-bold text-primary">{categoryTitle}</h2>
            ) : null}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => (
                <PackageListingCard key={pkg.detailsHref} pkg={pkg} />
              ))}
            </div>
          </div>

          <IndiaTourQuoteSidebar destinationLabel={hubTitle} />
        </div>
      </section>

      <Footer />
    </>
  );
}
