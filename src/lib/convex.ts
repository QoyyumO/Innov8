import { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL environment variable. " +
      "Set it in .env.local. Run `npx convex dev` to get the development URL.",
  );
}

export const convex = new ConvexReactClient(convexUrl);
export { api };
export type { Id } from "../../convex/_generated/dataModel";
