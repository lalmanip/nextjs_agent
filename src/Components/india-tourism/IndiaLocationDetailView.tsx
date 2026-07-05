import Link from "next/link";
import type {
  IndiaContentLink,
  IndiaContentSection,
  IndiaSiblingNav,
  IndiaTeaserCard,
  IndiaTourPackage,
} from "@/lib/indiaTourismNav";
import IndiaTourQuoteSidebar from "./IndiaTourQuoteSidebar";
import IndiaTourismHeader from "./IndiaTourismHeader";
import Footer from "@/Components/Footer";

type IndiaLocationDetailViewProps = {
  title: string;
  breadcrumb: { label: string; href?: string }[];
  imageUrl: string;
  description: string;
  sections?: IndiaContentSection[];
  siblingNav?: IndiaSiblingNav;
  currentPath?: string;
};

function LinkList({ links }: { links: IndiaContentLink[] }) {
  return (
    <ul className="space-y-1.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-sm text-gray-700 transition hover:text-primary">
            <span className="mr-1 text-primary">&gt;</span>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LinkGridCard({ title, links }: { title: string; links: IndiaContentLink[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-800">
        {title}
      </div>
      <div className="p-3">
        <LinkList links={links} />
      </div>
    </div>
  );
}

function TeaserCard({ card }: { card: IndiaTeaserCard }) {
  return (
    <article className="overflow-hidden rounded-xl border border-rose-100 bg-rose-50/70 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Link href={card.href} className="text-lg font-bold text-primary hover:underline">
            {card.title}
          </Link>
          {card.subtitle ? (
            <p className="mt-1 text-sm font-semibold text-[#1a2744]">{card.subtitle}</p>
          ) : null}
          {card.excerpt ? (
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{card.excerpt}</p>
          ) : null}
          <Link
            href={card.href}
            className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-semibold lowercase text-white transition hover:bg-primary-dark"
          >
            {card.readMoreLabel ?? "read more.."}
          </Link>
        </div>
        {card.imageUrl ? (
          <Link href={card.href} className="shrink-0 sm:order-last sm:w-36">
            <img
              src={card.imageUrl}
              alt={card.title}
              className="h-24 w-full rounded-lg object-cover sm:h-28 sm:w-36"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function TourPackageCard({ pkg }: { pkg: IndiaTourPackage }) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <Link href={pkg.detailsHref}>
        <img
          src={pkg.imageUrl}
          alt={pkg.title}
          className="aspect-[4/3] w-full object-cover"
        />
      </Link>
      <div className="space-y-2 p-4">
        <Link
          href={pkg.detailsHref}
          className="block text-base font-bold text-[#1a2744] hover:text-primary"
        >
          {pkg.title}
        </Link>
        <p className="text-sm text-gray-600">{pkg.duration}</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href={pkg.detailsHref}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Details
          </Link>
          <Link
            href="#tour-quote-form"
            className="text-sm font-medium text-primary hover:underline"
          >
            Enquire Now →
          </Link>
        </div>
      </div>
    </article>
  );
}

function SiblingNavBar({
  siblingNav,
  currentPath,
}: {
  siblingNav: IndiaSiblingNav;
  currentPath?: string;
}) {
  if (siblingNav.links.length < 2) return null;

  const currentHref = currentPath ? `/holidays/india/p/${currentPath}` : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-center">
        <strong className="text-sm font-semibold text-primary">{siblingNav.title}</strong>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-y-1 px-4 py-3 text-sm">
        {siblingNav.links.map((link, i) => {
          const isCurrent = currentHref ? link.href === currentHref : false;
          return (
            <span key={link.href} className="inline-flex items-center">
              {i > 0 && <span className="mx-2 text-gray-300" aria-hidden="true">|</span>}
              {isCurrent ? (
                <span className="font-semibold text-primary">{link.label}</span>
              ) : (
                <Link href={link.href} className="text-gray-700 transition hover:text-primary">
                  {link.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ItineraryMeta({ duration, destinations }: { duration: string; destinations: string }) {
  return (
    <div className="space-y-1 text-gray-800">
      {duration ? (
        <p>
          <strong>Duration:</strong> {duration}
        </p>
      ) : null}
      {destinations ? (
        <p>
          <strong>Destination Covered:</strong> {destinations}
        </p>
      ) : null}
    </div>
  );
}

function ItineraryDayHeader({ dayLabel, title }: { dayLabel: string; title: string }) {
  return (
    <div className="border-b border-gray-200 pb-2 pt-4 first:pt-0">
      <p className="text-base font-bold">
        <span className="text-gray-900">{dayLabel}</span>
        {title ? <span className="text-primary"> {title}</span> : null}
      </p>
    </div>
  );
}

function ItineraryBody({ text, html }: { text: string; html?: string }) {
  if (html) {
    return (
      <div
        className="leading-relaxed text-gray-700 [&_strong]:font-bold [&_strong]:text-gray-900"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p className="leading-relaxed text-gray-700">{text}</p>;
}

const DAY_HEADER_RE = /^Day\s+\d+\s*:\s*(.*)$/i;
const TOUR_META_RE = /^Duration:.*Destination Covered:/i;

function isLegacyDayHeader(text: string) {
  return DAY_HEADER_RE.test(text);
}

function isLegacyTourMeta(text: string) {
  return TOUR_META_RE.test(text);
}

function ContentSections({ sections }: { sections: IndiaContentSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div className="mt-8 space-y-4 text-gray-700">
      {sections.map((section, i) => {
        if (section.type === "itinerary-meta") {
          return (
            <ItineraryMeta
              key={`meta-${i}`}
              duration={section.duration}
              destinations={section.destinations}
            />
          );
        }

        if (section.type === "itinerary-heading") {
          return (
            <p
              key={`itin-h-${i}`}
              className="pt-4 text-center text-sm font-medium uppercase tracking-wide text-gray-500"
            >
              {section.text}
            </p>
          );
        }

        if (section.type === "itinerary-day") {
          return (
            <ItineraryDayHeader
              key={`day-${i}`}
              dayLabel={section.dayLabel}
              title={section.title}
            />
          );
        }

        if (section.type === "itinerary-body") {
          return <ItineraryBody key={`body-${i}`} text={section.text} html={section.html} />;
        }

        if (section.type === "destination-group") {
          return (
            <div key={`group-${i}`} className="space-y-4">
              <h4 className="text-lg font-bold text-primary">{section.heading}</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.groups.map((group) => (
                  <LinkGridCard key={group.title} title={group.title} links={group.links} />
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "link-grid") {
          return (
            <LinkGridCard key={`grid-${section.title}-${i}`} title={section.title} links={section.links} />
          );
        }

        if (section.type === "teaser-grid") {
          return (
            <div key={`teaser-${section.heading ?? i}`} className="space-y-4">
              {section.heading ? (
                <h2 className="text-xl font-bold text-primary">{section.heading}</h2>
              ) : null}
              {section.cards.map((card) => (
                <TeaserCard key={card.href} card={card} />
              ))}
            </div>
          );
        }

        if (section.type === "tour-package-grid") {
          return (
            <div key={`packages-${i}`} className="space-y-4">
              <h2 className="rounded-lg bg-sky-50 px-4 py-3 text-center text-lg font-bold text-[#1a2744]">
                {section.heading}
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {section.packages.map((pkg) => (
                  <TourPackageCard key={pkg.detailsHref} pkg={pkg} />
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "heading") {
          const size =
            section.level === 2
              ? "text-2xl font-bold text-gray-900"
              : section.level === 3
                ? "text-xl font-semibold text-gray-900"
                : "text-lg font-semibold text-gray-800";

          if (section.level === 2) {
            return (
              <h2 key={`h2-${i}`} className={size}>
                {section.text}
              </h2>
            );
          }
          if (section.level === 3) {
            return (
              <h3 key={`h3-${i}`} className={size}>
                {section.text}
              </h3>
            );
          }
          return (
            <h4 key={`h4-${i}`} className={size}>
              {section.text}
            </h4>
          );
        }

        if (section.type === "paragraph") {
          if (isLegacyTourMeta(section.text)) {
            const duration =
              section.text.match(/Duration:\s*(.+?)(?:\s*Destination Covered:|$)/i)?.[1]?.trim() ?? "";
            const destinations =
              section.text.match(/Destination Covered:\s*(.+)/i)?.[1]?.trim() ?? "";
            return (
              <ItineraryMeta key={`legacy-meta-${i}`} duration={duration} destinations={destinations} />
            );
          }

          const dayMatch = section.text.match(DAY_HEADER_RE);
          if (dayMatch) {
            const dayLabel = section.text.match(/^(Day\s+\d+\s*:)/i)?.[1] ?? "";
            return (
              <ItineraryDayHeader
                key={`legacy-day-${i}`}
                dayLabel={dayLabel.trim()}
                title={dayMatch[1]?.trim() ?? ""}
              />
            );
          }
        }

        return (
          <p key={`p-${i}`} className="leading-relaxed">
            {section.text}
          </p>
        );
      })}
    </div>
  );
}

/** Server-rendered layout; interactive header/form/footer stay as client components. */
export default function IndiaLocationDetailView({
  title,
  breadcrumb,
  imageUrl,
  description,
  sections = [],
  siblingNav,
  currentPath,
}: IndiaLocationDetailViewProps) {
  const hasSections = sections.length > 0;
  const isTourItineraryPage =
    sections.some((s) => s.type.startsWith("itinerary-")) ||
    (currentPath?.startsWith("tour-planner/") &&
      sections.some(
        (s) =>
          s.type === "paragraph" &&
          (isLegacyDayHeader(s.text) || isLegacyTourMeta(s.text)),
      ));
  const isListingPage = sections.some(
    (s) =>
      s.type === "link-grid" ||
      s.type === "destination-group" ||
      s.type === "teaser-grid" ||
      s.type === "tour-package-grid",
  );
  const showHeroImage = Boolean(imageUrl) && !isListingPage && !isTourItineraryPage;
  const descriptionDuplicatesContent =
    description &&
    (sections.some(
      (s) =>
        (s.type === "paragraph" || s.type === "itinerary-meta") &&
        ("text" in s ? s.text === description : false),
    ) ||
      sections.some(
        (s) =>
          s.type === "itinerary-meta" &&
          description.includes(s.duration) &&
          description.includes(s.destinations),
      ));
  const showDescription =
    Boolean(description) && !isListingPage && !isTourItineraryPage && !descriptionDuplicatesContent;

  return (
    <>
      <IndiaTourismHeader />

      <section className="bg-[#1a2744] py-12 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">{title}</h1>
        <nav className="mt-3 text-sm text-white/80" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`}>
              {i > 0 && <span className="mx-2">&gt;</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-white">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            {siblingNav ? (
              <div className="mb-6">
                <SiblingNavBar siblingNav={siblingNav} currentPath={currentPath} />
              </div>
            ) : null}
            {showHeroImage ? (
              <div className="overflow-hidden rounded-2xl shadow-md">
                <img
                  src={imageUrl}
                  alt={title}
                  className="aspect-[16/10] w-full object-cover"
                />
              </div>
            ) : null}
            {!hasSections && (
              <div className={`space-y-4 text-gray-700 ${showHeroImage ? "mt-8" : ""}`}>
                <h2 className="text-2xl font-bold text-gray-900">About {title}</h2>
                <p className="leading-relaxed">{description}</p>
              </div>
            )}
            {hasSections && (
              <>
                {showDescription ? (
                  <p className={`leading-relaxed text-gray-700 ${showHeroImage ? "mt-8" : ""}`}>
                    {description}
                  </p>
                ) : null}
                <ContentSections sections={sections} />
              </>
            )}
          </div>

          <IndiaTourQuoteSidebar destinationLabel={title} />
        </div>
      </section>

      <Footer />
    </>
  );
}
