import "server-only";

import pagesBundle from "@/data/india/pages-bundle.json";
import pagesExtra from "@/data/india/pages-extra.json";
import pagesExtraIndex from "@/data/india/pages-extra-index.json";
import {
  INDIA_REGIONS,
  type IndiaBreadcrumb,
  type IndiaContentLink,
  type IndiaContentSection,
  type IndiaSiblingNav,
} from "@/lib/indiaTourismNav";

export type { IndiaBreadcrumb, IndiaContentSection, IndiaSiblingNav };

export type IndiaLocationDetail = {
  slug: string;
  title: string;
  breadcrumbLabel: string;
  metaDescription?: string;
  description: string;
  imageUrl: string;
  sections: IndiaContentSection[];
  breadcrumb?: IndiaBreadcrumb[];
  siblingNav?: IndiaSiblingNav;
  path?: string;
  sourceUrl?: string;
};

type PagesBundle = {
  experiences: Record<string, IndiaLocationDetail>;
  states: Record<string, IndiaLocationDetail>;
  regions: Record<string, IndiaLocationDetail>;
};

type PagesExtra = Record<string, IndiaLocationDetail>;

const bundle = pagesBundle as PagesBundle;
const extra = pagesExtra as PagesExtra;
const extraIndex = pagesExtraIndex as { paths?: string[] };

type LinkContext = {
  parentLabel: string;
  parentHref: string;
  groupHeading?: string;
  groupTitle: string;
  siblingLinks: IndiaContentLink[];
};

function buildLinkContextIndex(): Map<string, LinkContext> {
  const index = new Map<string, LinkContext>();
  const categories: {
    pages: Record<string, IndiaLocationDetail>;
    parentHref: (slug: string) => string;
  }[] = [
    { pages: bundle.experiences, parentHref: (slug) => `/holidays/india/experiences/${slug}` },
    { pages: bundle.states, parentHref: (slug) => `/holidays/india/states/${slug}` },
    { pages: bundle.regions, parentHref: (slug) => `/holidays/india/regions/${slug}` },
  ];

  for (const { pages, parentHref } of categories) {
    for (const [slug, page] of Object.entries(pages)) {
      const parentLabel = page.breadcrumbLabel || page.title;
      for (const section of page.sections ?? []) {
        if (section.type === "destination-group") {
          for (const group of section.groups) {
            const ctx: LinkContext = {
              parentLabel,
              parentHref: parentHref(slug),
              groupHeading: section.heading,
              groupTitle: group.title,
              siblingLinks: group.links,
            };
            for (const link of group.links) index.set(link.href, ctx);
          }
        } else if (section.type === "link-grid") {
          const ctx: LinkContext = {
            parentLabel,
            parentHref: parentHref(slug),
            groupTitle: section.title,
            siblingLinks: section.links,
          };
          for (const link of section.links) index.set(link.href, ctx);
        }
      }
    }
  }

  return index;
}

const linkContextIndex = buildLinkContextIndex();

function enrichDetailNav(detail: IndiaLocationDetail, pathKey: string): IndiaLocationDetail {
  const pageHref = `/holidays/india/p/${pathKey}`;
  const ctx = linkContextIndex.get(pageHref);

  const siblingNav: IndiaSiblingNav | undefined =
    detail.siblingNav ??
    (ctx && ctx.siblingLinks.length > 1
      ? { title: ctx.groupTitle, links: ctx.siblingLinks }
      : undefined);

  let breadcrumb = detail.breadcrumb;
  if (ctx) {
    breadcrumb = [
      { label: ctx.parentLabel, href: ctx.parentHref },
      ...(ctx.groupHeading ? [{ label: ctx.groupHeading }] : []),
      ...(ctx.groupTitle ? [{ label: ctx.groupTitle }] : []),
      { label: detail.breadcrumbLabel },
    ];
  }

  return { ...detail, breadcrumb, siblingNav };
}

function normalizeDetail(page: IndiaLocationDetail | undefined): IndiaLocationDetail | null {
  if (!page) return null;
  return {
    ...page,
    sections: page.sections ?? [],
    description: page.description || page.metaDescription || "",
  };
}

export function indiaExtraPageHref(pathKey: string): string {
  return `/holidays/india/p/${pathKey}`;
}

export function listExtraPagePaths(): string[][] {
  const paths = extraIndex.paths ?? Object.keys(extra);
  return paths.map((p) => p.split("/").filter(Boolean));
}

export function getExtraPageDetail(pathSegments: string[]): IndiaLocationDetail | null {
  const pathKey = pathSegments.filter(Boolean).join("/");
  if (!pathKey) return null;
  const detail = normalizeDetail(extra[pathKey]);
  if (!detail) return null;
  return enrichDetailNav({ ...detail, path: pathKey }, pathKey);
}

export function getExperienceDetail(slug: string): IndiaLocationDetail | null {
  return normalizeDetail(bundle.experiences[slug]);
}

export function getStateDetail(slug: string): IndiaLocationDetail | null {
  return normalizeDetail(bundle.states[slug]);
}

export function getRegionDetail(slug: string): IndiaLocationDetail | null {
  const page = bundle.regions[slug];
  if (!page) return null;
  const region = INDIA_REGIONS.find((r) => r.slug === slug);
  return normalizeDetail({
    ...page,
    title: region?.title ?? page.title,
    breadcrumbLabel: region?.name ?? page.breadcrumbLabel,
  });
}
