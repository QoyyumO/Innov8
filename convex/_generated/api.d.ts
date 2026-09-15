/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as lib_demoUsers from "../lib/demoUsers.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_invariants from "../lib/invariants.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_synthetic from "../lib/synthetic.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "lib/demoUsers": typeof lib_demoUsers;
  "lib/domain": typeof lib_domain;
  "lib/invariants": typeof lib_invariants;
  "lib/password": typeof lib_password;
  "lib/roles": typeof lib_roles;
  "lib/session": typeof lib_session;
  "lib/synthetic": typeof lib_synthetic;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
