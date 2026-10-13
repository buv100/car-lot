/** Turns an address into a point. The distance itself is calculated in the domain. */
export interface Geocoder {
  geocode(address: string): Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
    countryCode: string;
  } | null>;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Accepts only `lat,lng`, optionally followed by the Israel suffix the service adds. */
export class FakeGeocoder implements Geocoder {
  geocode(address: string): Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
    countryCode: string;
  } | null> {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*ישראל)?\s*$/.exec(
      address,
    );
    if (match === null) return Promise.resolve(null);
    const latText = match[1];
    const lngText = match[2];
    if (latText === undefined || lngText === undefined) return Promise.resolve(null);
    const lat = Number(latText);
    const lng = Number(lngText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null);
    return Promise.resolve({
      lat,
      lng,
      formattedAddress: `${latText},${lngText}`,
      countryCode: "IL",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Google Geocoding. A result whose country is not IL is returned and then refused by the service. */
export class GoogleGeocoder implements Geocoder {
  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<{
    lat: number;
    lng: number;
    formattedAddress: string;
    countryCode: string;
  } | null> {
    if (this.apiKey.length === 0) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.apiKey);
    const response = await fetch(url);
    if (!response.ok) return null;
    return parseGoogle(await response.json());
  }
}

function parseGoogle(body: unknown): {
  lat: number;
  lng: number;
  formattedAddress: string;
  countryCode: string;
} | null {
  if (!isRecord(body) || !isList(body.results)) return null;
  const first = body.results[0];
  if (!isRecord(first) || typeof first.formatted_address !== "string") return null;
  if (!isRecord(first.geometry) || !isRecord(first.geometry.location)) return null;
  const lat = first.geometry.location.lat;
  const lng = first.geometry.location.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!isList(first.address_components)) return null;
  let countryCode = "";
  for (const component of first.address_components) {
    if (!isRecord(component) || !isList(component.types)) continue;
    if (!component.types.includes("country") || typeof component.short_name !== "string") continue;
    countryCode = component.short_name;
  }
  if (countryCode.length === 0) return null;
  return { lat, lng, formattedAddress: first.formatted_address, countryCode };
}

/** `GEOCODER=google` uses Google. Anything else, including `fake`, stays offline. */
export function geocoderFromEnv(env: NodeJS.ProcessEnv = process.env): Geocoder {
  if (env.GEOCODER === "google") return new GoogleGeocoder(env.GOOGLE_MAPS_API_KEY ?? "");
  return new FakeGeocoder();
}
