import { UBER_PRODUCTS_QUERY } from "./uber-query.js";
import { withSharedBrowser } from "../browser-pool.js";
import {
  evaluateJson,
  PAGE_TIMEOUT_MS,
  type LatLng,
  type RawFare,
} from "./fares.js";
const ORIGIN = "https://m.uber.com/";
const GRAPHQL_URL = "https://m.uber.com/go/graphql";
const E5 = 1e5;
interface UberResponse {
  data?: {
    products?: {
      tiers?: {
        products?: {
          productUuid?: string | null;
          displayName?: string | null;
          etaInMin?: number | null;
          isAvailable?: boolean | null;
          hasPromo?: boolean | null;
          preAdjustmentValue?: string | null;
          fares?: {
            fareAmountE5?: number | null;
            hasPromo?: boolean | null;
            preAdjustmentValue?: string | null;
          }[];
        }[];
      }[];
    };
  };
  errors?: {
    message: string;
    extensions?: {
      code?: string;
      title?: string;
      subtitle?: string;
    };
  }[];
}
/** Display strings like "₹55.00" carry no minor-unit field, so parse the digits. */
function parseDisplayPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type UberProduct = NonNullable<
  NonNullable<
    NonNullable<NonNullable<UberResponse["data"]>["products"]>["tiers"]
  >[number]["products"]
>[number];

/**
 * Pure mapping, exported for testing against saved responses without launching
 * a browser. Returns null for products with no usable price.
 */
export function toRawFare(product: UberProduct): RawFare | null {
  if (product.isAvailable === false) return null;
  if (!product.productUuid || !product.displayName) return null;

  const fare = product.fares?.[0];
  const amountE5 = fare?.fareAmountE5;

  // A promo-covered ride reports fareAmountE5 0 with hasPromo set. The real
  // price survives in preAdjustmentValue, so prefer it — showing ₹0 for a ₹55
  // ride is accurate but reads as broken.
  const promo = fare?.hasPromo === true || product.hasPromo === true;
  if (promo) {
    const real =
      parseDisplayPrice(fare?.preAdjustmentValue) ??
      parseDisplayPrice(product.preAdjustmentValue);
    if (real !== null && real > 0) {
      return {
        id: product.productUuid,
        name: product.displayName,
        minFare: real,
        maxFare: real,
      };
    }
  }

  if (amountE5 == null) return null;
  return {
    id: product.productUuid,
    name: product.displayName,
    minFare: amountE5 / E5,
    maxFare: amountE5 / E5,
  };
}
export async function getUberFareEstimates(
  pickup: LatLng,
  drop: LatLng,
): Promise<RawFare[]> {
  return withSharedBrowser(async (page) => {
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    await page.goto(ORIGIN, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });
    const body = JSON.stringify({
      operationName: "Products",
      variables: {
        includeRecommended: false,
        destinations: [{ latitude: drop.lat, longitude: drop.lng }],
        isHcv: false,
        payment: { uberCashToggleOn: true },
        pickup: { latitude: pickup.lat, longitude: pickup.lng },
      },
      query: UBER_PRODUCTS_QUERY,
    });
    const json = await evaluateJson<UberResponse>(page, "uber", {
      url: GRAPHQL_URL,
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-csrf-token": "x",
        "x-uber-client-name": "web-plan",
        "x-uber-rv-session-type": "desktop_session",
      },
      body,
    });

    const error = json.errors?.[0];
    if (error) {
      if (error.extensions?.code === "unauthorized") {
        throw new Error(
          "Uber rejected the session. The Solari profile is not logged in to " +
            "m.uber.com, or the session expired — re-seed SOLARI_PROFILE_ID.",
        );
      }
      throw new Error(
        `Uber GraphQL error: ${error.message}` +
          (error.extensions?.title ? ` (${error.extensions.title})` : ""),
      );
    }
    const tiers = json.data?.products?.tiers ?? [];
    const fares: RawFare[] = [];
    for (const tier of tiers) {
      for (const product of tier.products ?? []) {
        const mapped = toRawFare(product);
        if (mapped) fares.push(mapped);
      }
    }
    if (fares.length === 0) {
      console.warn(
        "[uber] request succeeded but contained zero priced products",
      );
    }
    return fares;
  });
}
