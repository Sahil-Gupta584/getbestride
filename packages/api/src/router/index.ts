import { compare, rapido, uber, ola } from "./quotes.js";

export default {
  quotes: { compare, rapido, uber, ola },
};

export { compare, rapido, uber, ola } from "./quotes.js";

export type {
  CompareResult,
  FareOption,
  Provider,
  ProviderResult,
  QuotesInput,
} from "./quotes.js";
