import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { quotesMiddleware } from "./router/index.js";
const app = express();
app.use(cors());
app.use(quotesMiddleware());
app.use(express.json({ limit: "10mb" }));
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "getbestride-backend",
    uptime: process.uptime(),
  });
});
app.listen(env.PORT, () => {
  console.log(`🚀 GetBestRide backend running at http://localhost:${env.PORT}`);
  console.log(`   quotes oRPC → http://localhost:${env.PORT}/rpc`);
});
