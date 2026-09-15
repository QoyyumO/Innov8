import { useAuth as useAuthContext } from "../context/AuthContext";

/**
 * Session auth for Convex calls (INN-35).
 *
 * Every domain function takes the session token as `token` and checks it
 * server-side with `requireSession` (`convex/lib/session.ts`). Never pass a
 * `userId` for authorization.
 *
 * Queries — skip until there is a session:
 *
 *   const { sessionToken } = useAuth();
 *   const user = useQuery(
 *     api.auth.getCurrentUser,
 *     sessionToken ? { token: sessionToken } : "skip",
 *   );
 *
 * Mutations — pass the same token. Patient search writes an audit row, so it
 * is a mutation (Convex queries cannot insert):
 *
 *   const searchPatients = useMutation(api.patients.searchPatients);
 *   if (sessionToken) {
 *     await searchPatients({ token: sessionToken, query });
 *   }
 *
 * The token lives under `innov8_session_token` and is managed by
 * `AuthContext`; do not read storage directly in pages.
 */
export function useAuth() {
  return useAuthContext();
}
