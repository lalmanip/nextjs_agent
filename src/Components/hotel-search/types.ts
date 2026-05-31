import { LocationSearchSelected } from "@/Components/LocationSearchInput";

export type SortOption = "price_asc" | "rating_desc";

export interface BackendRoomOption {
  Name?: string[];
  BookingCode: string;
  Inclusion?: string;
  DayRates?: Array<Array<{ BasePrice?: number }>>;
  TotalFare: number;
  TotalTax?: number;
  MealType?: string;
  IsRefundable?: boolean;
  Amenities?: string[] | null;
}

export interface BackendHotelResultItem {
  HotelCode: string;
  Currency?: string;
  Rooms?: BackendRoomOption[];
  HotelName?: string;
  Name?: string;
  StarRating?: number;
  Rating?: number;
  Address?: string;
  Amenities?: string[] | null;
  // Some backends enrich TBO results with geo fields for map view
  Latitude?: number | string;
  Longitude?: number | string;
  Lat?: number | string;
  Lng?: number | string;
}

export interface BackendHotelSearchResponse {
  success: boolean;
  data?: {
    Status?: { Code?: number; Description?: string };
    HotelResult?: BackendHotelResultItem[];
  };
}

export interface UiRoomOption {
  bookingCode: string;
  name: string;
  inclusion: string;
  mealType: string;
  refundable: boolean;
  totalFare: number;
  totalTax: number;
}

export interface HotelApiItem {
  hotelCode: string;
  name: string;
  currency: string;
  startingPrice: number;
  rating: number;
  starRating: number;
  address: string;
  amenities: string[];
  rooms: UiRoomOption[];
  lat?: number;
  lng?: number;
}

export interface RoomRequest {
  adults: number;
  children: number[]; // ages
}

/** TBO / product limits for hotel search occupancy per room */
export const HOTEL_MAX_ADULTS_PER_ROOM = 8;
export const HOTEL_MAX_CHILDREN_PER_ROOM = 4;

export function normalizeHotelRooms(rooms: RoomRequest[] | undefined | null): RoomRequest[] {
  const base = Array.isArray(rooms) && rooms.length ? rooms : [{ adults: 2, children: [] }];
  return base.map((r) => ({
    adults: Math.max(1, Math.min(HOTEL_MAX_ADULTS_PER_ROOM, Number(r?.adults || 1))),
    children: (Array.isArray(r?.children) ? r.children : [])
      .slice(0, HOTEL_MAX_CHILDREN_PER_ROOM)
      .map((a) => Math.max(0, Math.min(17, Number(a) || 0))),
  }));
}

export interface FiltersState {
  priceMin: number;
  priceMax: number;
  stars: number[];
  sort: SortOption;
}

export interface PaginationState {
  page: number;
  size: number;
  total: number;
}

export interface SearchState {
  location: LocationSearchSelected | null;
  checkIn: string;
  checkOut: string;
  rooms: RoomRequest[];
  filters: FiltersState;
  pagination: PaginationState;
}

