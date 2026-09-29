import type { RouterClient } from "@orpc/server";
import type router from "./router/index.js";

export type QuotesRouterClient = RouterClient<typeof router>;
