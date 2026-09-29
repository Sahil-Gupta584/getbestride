import { signRapidoRequest } from "../scraper/rapido/signer.js";
import { withSharedBrowser } from "../browser-pool.js";
import {
  evaluateJson,
  PAGE_TIMEOUT_MS,
  type LatLng,
  type RawFare,
} from "./fares.js";
const ORIGIN = "https://m.rapido.bike/";
const SERVICES_URL = "https://m.rapido.bike/pwa/api/unup/location/services";
const FARE_URL = "https://m.rapido.bike/pwa/api/unup/scc/fareEstimate";
interface ServicesResponse {
  data?: {
    data?: {
      _id: string;
      displayName?: string;
      name?: string;
    }[];
  };
}
function commonHeaders(pickup: LatLng): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    appid: "2",
    appversion: "214",
    authorization: "Bearer",
    "channel-entity": "customer",
    "channel-host": "browser",
    "channel-name": "pwa",
    "content-type": "application/json",
    latitude: String(pickup.lat),
    longitude: String(pickup.lng),
  };
}
function readVarint(
  bytes: Uint8Array,
  offset: number,
): {
  value: number;
  offset: number;
} {
  let value = 0;
  let shift = 0;
  while (offset < bytes.length) {
    const b = bytes[offset++]!;
    value += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value, offset };
}
function readDouble(
  bytes: Uint8Array,
  offset: number,
): {
  value: number;
  offset: number;
} {
  const buffer = new ArrayBuffer(8);
  new Uint8Array(buffer).set(bytes.subarray(offset, offset + 8));
  return {
    value: new DataView(buffer).getFloat64(0, true),
    offset: offset + 8,
  };
}
interface ProtoField {
  field: number;
  type: string;
  value: number | Uint8Array;
}
function parseProtoFlat(bytes: Uint8Array): ProtoField[] {
  let offset = 0;
  const results: ProtoField[] = [];
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >> 3;
    const wireType = tag.value & 7;
    if (wireType === 0) {
      const val = readVarint(bytes, offset);
      offset = val.offset;
      results.push({ field: fieldNumber, type: "varint", value: val.value });
    } else if (wireType === 1) {
      const val = readDouble(bytes, offset);
      offset = val.offset;
      results.push({ field: fieldNumber, type: "double", value: val.value });
    } else if (wireType === 2) {
      const len = readVarint(bytes, offset);
      offset = len.offset;
      const slice = bytes.subarray(offset, offset + len.value);
      offset += len.value;
      results.push({ field: fieldNumber, type: "bytes", value: slice });
    } else if (wireType === 5) {
      offset += 4;
    } else {
      break;
    }
  }
  return results;
}
export async function getRapidoFareEstimates(
  pickup: LatLng,
  drop: LatLng,
): Promise<RawFare[]> {
  const fareBody = JSON.stringify({
    pickupLocation: {
      lat: pickup.lat,
      lng: pickup.lng,
      displayName: pickup.label || "Custom Pickup",
      address: "",
    },
    dropLocation: {
      lat: drop.lat,
      lng: drop.lng,
      displayName: drop.label || "Custom Drop",
      address: "",
    },
    deviceId: "seo-route-pages",
  });
  const signature = await signRapidoRequest(fareBody);
  const headers = commonHeaders(pickup);
  return withSharedBrowser(async (page) => {
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    const servicesJson = await evaluateJson<ServicesResponse>(
      page,
      "rapido/services",
      {
        url: SERVICES_URL,
        method: "POST",
        headers,
        body: JSON.stringify({ lat: pickup.lat, lng: pickup.lng }),
      },
    );
    const serviceMap = new Map<string, string>();
    for (const s of servicesJson?.data?.data ?? []) {
      serviceMap.set(s._id, s.displayName || s.name || s._id);
    }
    const protoArray = await evaluateJson<number[]>(page, "rapido/fares", {
      url: FARE_URL,
      method: "POST",
      headers: { ...headers, ...signature },
      body: fareBody,
    });
    if (!Array.isArray(protoArray)) {
      throw new Error(
        "rapido/fares: expected a JSON array of bytes, got " +
          typeof protoArray,
      );
    }
    const top = parseProtoFlat(new Uint8Array(protoArray));
    const fares: RawFare[] = [];
    for (const item of top) {
      if (item.field !== 2 || item.type !== "bytes") continue;
      for (const inner of parseProtoFlat(item.value as Uint8Array)) {
        if (inner.field !== 4 || inner.type !== "bytes") continue;
        let serviceId: string | null = null;
        let minFare: number | null = null;
        let maxFare: number | null = null;
        for (const entry of parseProtoFlat(inner.value as Uint8Array)) {
          if (entry.field === 2 && entry.type === "bytes") {
            serviceId = new TextDecoder().decode(entry.value as Uint8Array);
          } else if (entry.field === 3 && entry.type === "double") {
            minFare = entry.value as number;
          } else if (entry.field === 4 && entry.type === "double") {
            maxFare = entry.value as number;
          }
        }
        if (
          serviceId === null ||
          !serviceMap.has(serviceId) ||
          minFare === null ||
          maxFare === null
        ) {
          continue;
        }
        fares.push({
          id: serviceId,
          name: serviceMap.get(serviceId)!,
          minFare: Math.round(minFare),
          maxFare: Math.round(maxFare),
        });
      }
    }
    if (fares.length === 0) {
      console.warn(
        `[rapido/fares] request succeeded but decoded 0 fares (${protoArray.length} bytes)`,
      );
    }
    return fares;
  });
}
