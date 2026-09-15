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
 *   const results = useQuery(
 *     api.patients.search,
 *     sessionToken ? { token: sessionToken, publicId } : "skip",
 *   );
 *
 * Mutations — pass the same token:
 *
 *   const requestAccess = useMutation(api.accessRequests.create);
 *   if (sessionToken) {
 *     await requestAccess({ token: sessionToken, ...fields });
 *   }
 *
 * The token lives under `innov8_session_token` and is managed by
 * `AuthContext`; do not read storage directly in pages.
 */
export function useAuth() {
  return useAuthContext();
}
