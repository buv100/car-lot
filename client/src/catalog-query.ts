const CAR_TYPES = ["mini", "family", "suv", "seven_seat", "luxury", "commercial"] as const;

export type CarType = (typeof CAR_TYPES)[number];

const MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type RentSearch = {
  pickup: string;
  returnAt: string;
  age: string;
  primaryType: CarType | "";
  returnMode: "lot" | "address";
  returnAddress: string;
  tagId: string;
  insurancePackageId: string;
};

export type SaleSearch = {
  maxKm: string;
  condition: "excellent" | "good" | "fair" | "any";
  primaryType: CarType | "";
  tagId: string;
};

function isCarType(value: string): value is CarType {
  for (const type of CAR_TYPES) {
    if (type === value) return true;
  }
  return false;
}

/** A rental search the server can price. A missing field stays on the form and lists no cars. */
export function readRentSearch(params: URLSearchParams): RentSearch | null {
  const pickup = params.get("pickup") ?? "";
  const returnAt = params.get("returnAt") ?? "";
  const age = params.get("age") ?? "";
  const primaryType = params.get("primaryType") ?? "";
  const returnMode = params.get("returnMode") ?? "";
  const returnAddress = params.get("returnAddress") ?? "";
  if (!MINUTE.test(pickup) || !MINUTE.test(returnAt)) return null;
  if (!/^\d+$/.test(age)) return null;
  const ageNumber = Number(age);
  if (ageNumber < 16 || ageNumber > 99) return null;
  if (primaryType !== "" && !isCarType(primaryType)) return null;
  if (returnMode !== "lot" && returnMode !== "address") return null;
  if (returnMode === "address" && returnAddress.trim() === "") return null;
  return {
    pickup,
    returnAt,
    age,
    primaryType,
    returnMode,
    returnAddress,
    tagId: params.get("tagId") ?? "",
    insurancePackageId: params.get("insurancePackageId") ?? "",
  };
}

/** Query string for the rental search and the car page. The server prices it again. */
export function rentQueryString(search: RentSearch): string {
  const params = new URLSearchParams({
    pickup: search.pickup,
    returnAt: search.returnAt,
    age: search.age,
    returnMode: search.returnMode,
  });
  if (search.primaryType !== "") params.set("primaryType", search.primaryType);
  if (search.returnMode === "address") params.set("returnAddress", search.returnAddress);
  if (search.tagId !== "") params.set("tagId", search.tagId);
  if (search.insurancePackageId !== "") params.set("insurancePackageId", search.insurancePackageId);
  return params.toString();
}

/** Kilometres above this are not a real filter. A blank field uses it. */
export const saleKmCeiling = "10000000";

/**
 * Search params from the buy form.
 * A blank kilometre field means no limit, and a blank condition means every condition.
 */
export function saleSearchParams(input: {
  maxKm: string;
  condition: string;
  primaryType: string;
}): URLSearchParams {
  const maxKm = input.maxKm.trim() === "" ? saleKmCeiling : input.maxKm.trim();
  const condition = input.condition.trim() === "" ? "any" : input.condition.trim();
  const params = new URLSearchParams({ maxKm, condition });
  if (input.primaryType !== "") params.set("primaryType", input.primaryType);
  return params;
}

/** A purchase search. Kilometres and condition are required. An empty type means every type. */
export function readSaleSearch(params: URLSearchParams): SaleSearch | null {
  const maxKm = params.get("maxKm") ?? "";
  const condition = params.get("condition") ?? "";
  const primaryType = params.get("primaryType") ?? "";
  if (!/^[1-9]\d*$/.test(maxKm)) return null;
  if (
    condition !== "excellent" &&
    condition !== "good" &&
    condition !== "fair" &&
    condition !== "any"
  ) {
    return null;
  }
  if (primaryType !== "" && !isCarType(primaryType)) return null;
  return { maxKm, condition, primaryType, tagId: params.get("tagId") ?? "" };
}

/** Query string for the sale results. */
export function saleQueryString(search: SaleSearch): string {
  const params = new URLSearchParams({
    maxKm: search.maxKm,
    condition: search.condition,
  });
  if (search.primaryType !== "") params.set("primaryType", search.primaryType);
  if (search.tagId !== "") params.set("tagId", search.tagId);
  return params.toString();
}

export const carTypes = CAR_TYPES;
