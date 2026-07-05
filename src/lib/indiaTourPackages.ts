import "server-only";

import tourPackagesJson from "@/data/india/tour-packages.json";
import type {
  IndiaTourCategoryTab,
  IndiaTourPackageListing,
  IndiaTourPackageSubTab,
} from "@/lib/indiaTourismNav";
import { INDIA_TOUR_PACKAGE_CATEGORIES } from "@/lib/indiaTourismNav";

export type IndiaTourPackageCategoryData = {
  slug: string;
  title: string;
  sourcePath: string;
  intro: string[];
  packages: IndiaTourPackageListing[];
  subTabs?: IndiaTourPackageSubTab[];
};

type TourPackagesJson = {
  hubTitle: string;
  defaultCategory: string;
  tabs: IndiaTourCategoryTab[];
  categories: Record<string, IndiaTourPackageCategoryData>;
};

const data = tourPackagesJson as TourPackagesJson;

export type IndiaTourPackagePageData = {
  categorySlug: string;
  hubTitle: string;
  categoryTitle: string;
  intro: string[];
  tabs: IndiaTourCategoryTab[];
  packages: IndiaTourPackageListing[];
  subTabs?: IndiaTourPackageSubTab[];
  activeSubTabSlug?: string;
  categorySourcePath: string;
};

export function getTourPackageHubTitle(): string {
  return data.hubTitle;
}

export function getTourPackageTabs(): IndiaTourCategoryTab[] {
  if (data.tabs.length > 0) return data.tabs;
  return INDIA_TOUR_PACKAGE_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label }));
}

export function getTourPackageCategory(slug: string): IndiaTourPackageCategoryData | null {
  return data.categories[slug] ?? null;
}

export function listTourPackageCategorySlugs(): string[] {
  return INDIA_TOUR_PACKAGE_CATEGORIES.map((c) => c.slug);
}

export function listTourPackageSubTabParams(): { category: string; subTab: string }[] {
  const params: { category: string; subTab: string }[] = [];
  for (const categorySlug of listTourPackageCategorySlugs()) {
    const category = getTourPackageCategory(categorySlug);
    if (!category?.subTabs) continue;
    for (const subTab of category.subTabs) {
      if (subTab.sourcePath === category.sourcePath) continue;
      params.push({ category: categorySlug, subTab: subTab.slug });
    }
  }
  return params;
}

export function getTourPackagePageData(
  categorySlug: string,
  subTabSlug?: string,
): IndiaTourPackagePageData | null {
  const category = getTourPackageCategory(categorySlug);
  if (!category) return null;

  const hubTitle = getTourPackageHubTitle();
  const tabs = getTourPackageTabs();

  if (subTabSlug) {
    const subTab = category.subTabs?.find((item) => item.slug === subTabSlug);
    if (!subTab) return null;
    return {
      categorySlug,
      hubTitle,
      categoryTitle: subTab.title,
      intro: subTab.intro.length > 0 ? subTab.intro : category.intro,
      tabs,
      packages: subTab.packages,
      subTabs: category.subTabs,
      activeSubTabSlug: subTabSlug,
      categorySourcePath: category.sourcePath,
    };
  }

  const defaultSubTab = category.subTabs?.find((item) => item.sourcePath === category.sourcePath);
  return {
    categorySlug,
    hubTitle,
    categoryTitle: category.title,
    intro: category.intro,
    tabs,
    packages: category.packages,
    subTabs: category.subTabs,
    activeSubTabSlug: defaultSubTab?.slug,
    categorySourcePath: category.sourcePath,
  };
}
