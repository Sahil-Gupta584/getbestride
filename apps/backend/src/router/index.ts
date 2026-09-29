import { RPCHandler } from "@orpc/server/node";
import type { Request, Response, NextFunction } from "express";
import router from "@repo/api";

const handler = new RPCHandler(router);

export function quotesMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.url.startsWith("/rpc")) return next();

    try {
      const { matched } = await handler.handle(req, res, { prefix: "/rpc" });
      if (!matched) {
        res.status(404).json({ error: "Not Found" });
      }
    } catch (error) {
      next(error);
    }
  };
}
