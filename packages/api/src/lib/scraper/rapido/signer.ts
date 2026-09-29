/**
 * Rapido request signer ("thiqa-kmp").
 *
 * Rapido's PWA signs outbound requests to a small set of endpoints with four
 * headers (x-km, x-m, x-ekref, x-pm). The signing is a Kotlin/WASM module
 * (`platform-mobile-sdks-thiqa-kmp.wasm`) driven by a small JS shim, and the
 * two inputs it needs are published in `https://m.rapido.bike/assets/env.js`:
 *
 *   signatureVerificationSKey: '1751212510000'
 *   signatureVerificationSequence: 'earab8hTY5TfLpmr7Ma89uw6zcIjvE+RGZf8qsW4W+/xfOSE6Etd15v1dfTMQCIk'
 *
 * There is no secret and no bearer token: an absent `Authorization` header is
 * treated identically to `Authorization: Bearer` with an empty value. The
 * envelope binds the request body plus a per-request UUID and the current time,
 * so a fresh signature must be minted for every distinct body.
 *
 * The three vendored assets under ./assets are lifted verbatim out of Rapido's
 * published bundles. Run `npm run sync:rapido` to refresh them; the module
 * verifies pinned SHA-256 digests at load so an upstream change fails loudly
 * instead of silently producing garbage.
 */
import { createHash, webcrypto } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ASSETS_DIR = resolveAssetsDir();

/**
 * Locate the vendored assets. In dev this module sits beside them; in a
 * production build the `rapidoAssets()` Vite plugin copies them next to the
 * server bundle (see vite.config.ts), so probe a few known shapes before giving
 * up. Cached because it runs on the hot path of the first request only.
 */
function resolveAssetsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "assets"), // unbundled (tsx / dev)
    join(here, "rapido-assets"), // beside the server bundle
    join(here, "..", "rapido-assets"),
    join(here, "..", "..", "rapido-assets"),
    join(here, "..", "..", "..", "rapido-assets"),
    join(
      process.cwd(),
      "packages",
      "api",
      "src",
      "lib",
      "scraper",
      "rapido",
      "assets",
    ),
    join(
      process.cwd(),
      "apps",
      "backend",
      "src",
      "lib",
      "scraper",
      "rapido",
      "assets",
    ),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "thiqa.wasm"))) return dir;
  }
  throw new Error(
    "Could not locate the Rapido signing assets. Looked in:\n  " +
      candidates.map((c) => `- ${c}`).join("\n  ") +
      "\nRun: npm run sync:rapido -- --write",
  );
}

/** Published in https://m.rapido.bike/assets/env.js */
const S_KEY = "1751212510000";
const SEQUENCE =
  "earab8hTY5TfLpmr7Ma89uw6zcIjvE+RGZf8qsW4W+/xfOSE6Etd15v1dfTMQCIk";

/** Paths Rapido's own interceptor signs. Everything else is unsigned. */
export const SIGNED_PATHS = [
  "/pwa/api/unup/scc/fareEstimate",
  "/pwa/api/pricing/getFareEstimate",
  "/pwa/api/order/book",
] as const;

/** Digests of the vendored assets, matching Rapido's own integrity pins. */
const EXPECTED_SHA256 = {
  "thiqa.wasm":
    "477c0bc399dc489b9b68ed2d1c86de7a2f4b3f271220a2d3e29e609c2dbae8b3",
  "thiqa-glue.js":
    "014a4bdd1be2c34142fd92063bedaff1b82ca7a3a823a9b81528496fb166d53b",
  "joda-core.js":
    "28e2997e87e5ffa1f4615b22ce1ade2afd156ebdf1a7bd8fb11ba5c5adc2f2f4",
} as const;

export interface SignatureHeaders {
  "x-km": string;
  "x-m": string;
  "x-ekref": string;
  "x-pm": string;
}

/** Subset of the WASM exports we actually call. */
interface ThiqaExports {
  getThiqa: (
    body: string,
    sKey: string,
    sequence: string,
    metadata: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    xM: string;
    xKm: string;
    xEkref: string;
    xPm: string;
  }>;
  memory: WebAssembly.Memory;
}

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

function readAsset(name: keyof typeof EXPECTED_SHA256): Buffer {
  const bytes = readFileSync(join(ASSETS_DIR, name));
  const actual = sha256(bytes);
  const expected = EXPECTED_SHA256[name];
  if (actual !== expected) {
    throw new Error(
      `Rapido asset "${name}" digest mismatch.\n` +
        `  expected ${expected}\n` +
        `  actual   ${actual}\n` +
        `Rapido has probably shipped a new bundle. Run: npm run sync:rapido`,
    );
  }
  return bytes;
}

/**
 * The Kotlin/WASM loader and the `@js-joda/core` bundle both expect a browser.
 * Provide the handful of globals the wasm actually touches.
 */
function installBrowserStubs(): void {
  const g = globalThis as Record<string, unknown>;
  const origin = "https://m.rapido.bike";
  if (!g.location) g.location = new URL(`${origin}/`);
  if (!g.document) {
    g.document = { baseURI: `${origin}/`, location: g.location, referrer: "" };
  }
  if (!g.window) g.window = globalThis;
  if (!g.self) g.self = globalThis;
  if (!g.navigator) {
    g.navigator = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      language: "en-US",
      languages: ["en-US"],
      platform: "Win32",
    };
  }
  // The wasm calls crypto.subtle.* rather than node:crypto.
  if (!g.crypto) g.crypto = webcrypto;
}

/** The slice of webpack's module runtime that `PxaB` touches. */
interface WebpackRuntime {
  (id: string): never;
  /** marks the module as an ES module */
  r: (moduleExports: Record<string, unknown>) => void;
  /** defines a lazy getter export */
  d: (
    moduleExports: Record<string, unknown>,
    name: string,
    getter: () => unknown,
  ) => void;
}

/**
 * Evaluate a webpack module body (`name:function(t,e,n){...}`) and return its
 * exports. `PxaB` has no internal requires, so a three-line runtime is enough.
 */
function loadWebpackModule(body: string): Record<string, unknown> {
  const factory = new Function(
    `return (${body.replace(/^\s*\w+\s*:\s*/, "")})`,
  )() as (
    require: WebpackRuntime,
    module: Record<string, unknown>,
    runtime: WebpackRuntime,
  ) => void;

  const runtime = ((id: string): never => {
    throw new Error(`Rapido joda bundle unexpectedly required "${id}"`);
  }) as WebpackRuntime;

  runtime.r = (moduleExports) => {
    if (!Object.prototype.hasOwnProperty.call(moduleExports, "__esModule")) {
      moduleExports.__esModule = true;
    }
  };
  runtime.d = (moduleExports, name, getter) => {
    Object.defineProperty(moduleExports, name, {
      enumerable: true,
      get: getter,
    });
  };

  const moduleExports: Record<string, unknown> = {};
  factory(runtime, moduleExports, runtime);
  return moduleExports;
}

/**
 * The vendored glue routes Kotlin `println`/Kermit output to `console`, and the
 * signer debug-prints every request ("Requesting Thiqa with data: …"). Give the
 * glue its own console so that chatter never reaches our logs — warnings and
 * errors still pass through untouched.
 */
const isChatter = (args: unknown[]): boolean =>
  typeof args[0] === "string" && args[0].startsWith("Requesting Thiqa");

const chatter =
  (method: "log" | "info") =>
  (...args: unknown[]): void => {
    if (!isChatter(args)) console[method](...args);
  };

const signerConsole = {
  log: chatter("log"),
  info: chatter("info"),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let exportsPromise: Promise<ThiqaExports> | undefined;

async function instantiate(): Promise<ThiqaExports> {
  installBrowserStubs();

  const wasmBytes = readAsset("thiqa.wasm");
  const glueSource = readAsset("thiqa-glue.js").toString("utf8");
  const joda = loadWebpackModule(readAsset("joda-core.js").toString("utf8"));

  // Reproduce the two transforms Rapido's own interceptor applies to the
  // inlined loader before handing it to `new Function`.
  //
  // The glue's Node branch does `createRequire(import.meta.url)` then
  // `import.meta.resolve('./platform-mobile-sdks-thiqa-kmp.wasm')` and reads the
  // module off disk, so both have to resolve. Point them at a scratch dir rather
  // than the vendored assets, which must stay byte-identical to Rapido's bundle.
  const scratchDir = join(tmpdir(), "rapido-thiqa");
  mkdirSync(scratchDir, { recursive: true });
  writeFileSync(
    join(scratchDir, "platform-mobile-sdks-thiqa-kmp.wasm"),
    wasmBytes,
  );

  const selfUrl = pathToFileURL(join(scratchDir, "loader.mjs")).href;
  const importMetaStub =
    `({url:${JSON.stringify(selfUrl)},resolve:function(p){` +
    `return require("url").pathToFileURL(require("path").resolve(` +
    `${JSON.stringify(scratchDir)},p)).href}})`;
  const glue = glueSource
    .replace(/\bexport\s+/g, "")
    .replace(/import\.meta/g, () => importMetaStub);

  const instantiateFn = new Function(
    "fetch",
    "console",
    `${glue}\nreturn instantiate;`,
  )((input: unknown) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith(".wasm")) {
      return Promise.resolve(
        new Response(new Uint8Array(wasmBytes), {
          status: 200,
          headers: { "Content-Type": "application/wasm" },
        }),
      );
    }
    throw new Error(`Unexpected fetch during wasm init: ${url}`);
  }, signerConsole) as (imports: Record<string, unknown>) => Promise<{
    exports: ThiqaExports;
  }>;

  const { exports } = await instantiateFn({ "@js-joda/core": joda });
  return exports;
}

function loadExports(): Promise<ThiqaExports> {
  exportsPromise ??= instantiate().catch((cause) => {
    // Don't cache a failed init; a later call may succeed.
    exportsPromise = undefined;
    throw cause;
  });
  return exportsPromise;
}

/**
 * Sign a request body, returning the four headers to merge into the request.
 * Mints a fresh random UUID each call, matching the browser client.
 */
export async function signRapidoRequest(
  body: string,
): Promise<SignatureHeaders> {
  const wasm = await loadExports();
  const metadata = JSON.stringify({ id: webcrypto.randomUUID() });
  const result = await wasm.getThiqa(body, S_KEY, SEQUENCE, metadata);
  if (!result.success) {
    throw new Error(`[thiqa-kmp] ${result.error ?? "unknown error"}`);
  }
  return {
    "x-km": result.xKm,
    "x-m": result.xM,
    "x-ekref": result.xEkref,
    "x-pm": result.xPm,
  };
}

/** Test seam: drop the memoised instance. */
export function resetSignerForTests(): void {
  exportsPromise = undefined;
}
