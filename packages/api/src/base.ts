import { ORPCError, os } from "@orpc/server";

export const base = os.use(async ({ next, path }) => {
  try {
    return await next();
  } catch (error) {
    console.error(
      "[oRPC Error]",
      "Path",
      path,
      JSON.parse(JSON.stringify(error)),
    );
    if (error instanceof ORPCError) throw error;

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Something went wrong",
    });
  }
});
