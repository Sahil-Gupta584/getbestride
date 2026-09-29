import { z } from "zod";

import { base } from "../base.js";
import { getOlaFareEstimates } from "../lib/solari/ola.js";
import { getRapidoFareEstimates } from "../lib/solari/rapido.js";
import { getUberFareEstimates } from "../lib/solari/uber.js";
import type { RawFare } from "../lib/solari/fares.js";

export const placeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(500).default(""),
});

export const quotesInputSchema = z.object({
  pickup: placeSchema,
  drop: placeSchema,
});

export const fareOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  minFare: z.number(),
  maxFare: z.number(),
});

export const providerSchema = z.enum(["rapido", "uber", "ola"]);

export const providerResultSchema = z.object({
  provider: providerSchema,
  ok: z.boolean(),
  fetchedAt: z.string(),
  currency: z.string().nullable(),
  options: z.array(fareOptionSchema),
  error: z.string().nullable(),
  pickup: z.object({ label: z.string() }),
  drop: z.object({ label: z.string() }),
});

export const compareResultSchema = z.object({
  pickup: placeSchema,
  drop: placeSchema,
  cheapest: fareOptionSchema.extend({ provider: providerSchema }).nullable(),
  providers: z.array(providerResultSchema),
});

export type QuotesInput = z.infer<typeof quotesInputSchema>;
export type FareOption = z.infer<typeof fareOptionSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type ProviderResult = z.infer<typeof providerResultSchema>;
export type CompareResult = z.infer<typeof compareResultSchema>;

type ProviderFetcher = (input: QuotesInput) => Promise<FareOption[]>;

const toOptions = (fares: RawFare[]): FareOption[] =>
  fares.map((f) => ({
    id: f.id,
    name: f.name,
    minFare: f.minFare,
    maxFare: f.maxFare,
  }));

async function runProvider(
  provider: Provider,
  fetch: ProviderFetcher,
  input: QuotesInput,
): Promise<ProviderResult> {
  const fetchedAt = new Date().toISOString();
  const echo = {
    pickup: { label: input.pickup.label },
    drop: { label: input.drop.label },
  };
  try {
    const options = await fetch(input);
    if (options.length === 0) {
      console.warn(
        `[quotes:${provider}] empty: 0 fares (request succeeded) ` +
          `(${input.pickup.label} → ${input.drop.label})`,
      );
    }
    return {
      provider,
      ok: true,
      fetchedAt,
      currency: "INR",
      options,
      error: null,
      ...echo,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(
      `[quotes:${provider}] failed: ${message} ` +
        `(${input.pickup.label} → ${input.drop.label})`,
    );
    return {
      provider,
      ok: false,
      fetchedAt,
      currency: null,
      options: [],
      error: message,
      ...echo,
    };
  }
}

const fetchRapido: ProviderFetcher = (input) =>
  getRapidoFareEstimates(input.pickup, input.drop).then(toOptions);

const fetchUber: ProviderFetcher = (input) =>
  getUberFareEstimates(input.pickup, input.drop).then(toOptions);

const fetchOla: ProviderFetcher = (input) =>
  getOlaFareEstimates(input.pickup, input.drop).then(toOptions);

export const rapido = base
  .input(quotesInputSchema)
  .output(providerResultSchema)
  .handler(({ input }) => runProvider("rapido", fetchRapido, input));

export const uber = base
  .input(quotesInputSchema)
  .output(providerResultSchema)
  .handler(({ input }) => runProvider("uber", fetchUber, input));

export const ola = base
  .input(quotesInputSchema)
  .output(providerResultSchema)
  .handler(({ input }) => runProvider("ola", fetchOla, input));

export const compare = base
  .input(quotesInputSchema)
  .output(compareResultSchema)
  .handler(async ({ input }) => {
    const providers = await Promise.all([
      runProvider("rapido", fetchRapido, input),
      runProvider("uber", fetchUber, input),
      runProvider("ola", fetchOla, input),
    ]);

    const cheapest = providers
      .filter((p) => p.ok)
      .flatMap((p) => p.options.map((o) => ({ ...o, provider: p.provider })))
      .reduce<(FareOption & { provider: Provider }) | null>(
        (best, option) =>
          best === null || option.minFare < best.minFare ? option : best,
        null,
      );

    return { pickup: input.pickup, drop: input.drop, cheapest, providers };
  });
