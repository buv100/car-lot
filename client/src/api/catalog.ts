import { api, type ApiResult } from "./staff";

export type PublicLot = {
  name: string;
  address: string;
  phone: string;
  publicEmail: string;
};

export type PublicTag = { id: string; name: string };

export type RentOffer = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  minAge: number;
  tags: PublicTag[];
  photo: { id: string; alt: string } | null;
  totalAgorot: number;
  rentalAgorot: number;
  insuranceAgorot: number;
  deliveryFeeAgorot: number;
  kmAllowance: number;
};

export type RentDetail = RentOffer & {
  photos: { id: string; alt: string; sortOrder: number }[];
  lines: {
    start: string;
    hours: number;
    dayKind: "weekday" | "weekend" | "holiday";
    agorot: number;
  }[];
  packages: {
    id: string;
    name: string;
    description: string;
    dailyPriceAgorot: number;
    includedInBase: boolean;
  }[];
  selectedPackageId: string;
  returnMode: "lot" | "address";
  returnAddress: string;
  straightLineKm: number;
  billedKm: number;
};

export type SaleOffer = {
  id: string;
  make: string;
  model: string;
  year: number;
  currentKm: number;
  conditionGrade: "excellent" | "good" | "fair";
  primaryType: string;
  tags: PublicTag[];
  photo: { id: string; alt: string } | null;
  salePriceAgorot: number;
  depositAgorot: number;
};

export type SaleDetail = SaleOffer & {
  color: string;
  seats: number;
  ownersCount: number;
  accidentsNone: boolean;
  knownAccidents: string | null;
  deepTreatmentCompletedAt: string | null;
  photos: { id: string; alt: string; sortOrder: number }[];
};

/** Public photo path. The plate is not part of the URL. */
export function photoUrl(carId: string, photoId: string): string {
  return `/media/cars/${carId}/${photoId}`;
}

/** Lot name, address, and phone for the public header. */
export function loadLot(): Promise<ApiResult<PublicLot>> {
  return api<PublicLot>("/api/catalog/lot");
}

export function loadTags(): Promise<ApiResult<PublicTag[]>> {
  return api<PublicTag[]>("/api/catalog/tags");
}

export function loadRentals(query: string): Promise<ApiResult<RentOffer[]>> {
  return api<RentOffer[]>(`/api/rent/search?${query}`);
}

export function loadRental(id: string, query: string): Promise<ApiResult<RentDetail>> {
  return api<RentDetail>(`/api/rent/cars/${id}?${query}`);
}

export function loadSales(query: string): Promise<ApiResult<SaleOffer[]>> {
  return api<SaleOffer[]>(`/api/buy/search?${query}`);
}

export function loadSale(id: string): Promise<ApiResult<SaleDetail>> {
  return api<SaleDetail>(`/api/buy/cars/${id}`);
}

export type FleetCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  primaryType: string;
  seats: number;
  currentKm: number;
  tags: PublicTag[];
  photo: { id: string; alt: string } | null;
  photoCount: number;
};

export type FleetDetail = FleetCar & {
  photos: { id: string; alt: string; sortOrder: number }[];
};

export function loadFleet(): Promise<ApiResult<FleetCar[]>> {
  return api<FleetCar[]>("/api/buy/all");
}

export function loadFleetCar(id: string): Promise<ApiResult<FleetDetail>> {
  return api<FleetDetail>(`/api/buy/all/${id}`);
}
