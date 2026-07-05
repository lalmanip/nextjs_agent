import HolidayHeroBanner from "./HolidayHeroBanner";
import TrendingDestinations from "./TrendingDestinations";
import SeasonalWhenWhere from "./SeasonalWhenWhere";

export default function HolidayPartnersScroll({ internationalOnly = false }: { internationalOnly?: boolean }) {
  return (
    <>
      <HolidayHeroBanner />
      <TrendingDestinations internationalOnly={internationalOnly} />
      <SeasonalWhenWhere />
    </>
  );
}
