import { startOfLagosDay } from "../../convex/lib/dashboardConstants";
import { useNow } from "./useNow";

const MINUTE_MS = 60_000;

/** Midnight in Lagos today; changes once a day so dashboard queries stay cached. */
export function useStartOfToday(): number {
  return startOfLagosDay(useNow(MINUTE_MS));
}
