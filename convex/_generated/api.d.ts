/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessRequests from "../accessRequests.js";
import type * as auth from "../auth.js";
import type * as lib_accessRequestMessages from "../lib/accessRequestMessages.js";
import type * as lib_authConstants from "../lib/authConstants.js";
import type * as lib_demoIds from "../lib/demoIds.js";
import type * as lib_demoUsers from "../lib/demoUsers.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_invariants from "../lib/invariants.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_searchLimits from "../lib/searchLimits.js";
import type * as lib_services_accessControlService from "../lib/services/accessControlService.js";
import type * as lib_services_auditLogService from "../lib/services/auditLogService.js";
import type * as lib_services_patientDiscoveryService from "../lib/services/patientDiscoveryService.js";
import type * as lib_services_recordExchangeService from "../lib/services/recordExchangeService.js";
import type * as lib_services_riskScoringService from "../lib/services/riskScoringService.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_synthetic from "../lib/synthetic.js";
import type * as patients from "../patients.js";
import type * as records from "../records.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessRequests: typeof accessRequests;
  auth: typeof auth;
  "lib/accessRequestMessages": typeof lib_accessRequestMessages;
  "lib/authConstants": typeof lib_authConstants;
  "lib/demoIds": typeof lib_demoIds;
  "lib/demoUsers": typeof lib_demoUsers;
  "lib/domain": typeof lib_domain;
  "lib/invariants": typeof lib_invariants;
  "lib/password": typeof lib_password;
  "lib/roles": typeof lib_roles;
  "lib/searchLimits": typeof lib_searchLimits;
  "lib/services/accessControlService": typeof lib_services_accessControlService;
  "lib/services/auditLogService": typeof lib_services_auditLogService;
  "lib/services/patientDiscoveryService": typeof lib_services_patientDiscoveryService;
  "lib/services/recordExchangeService": typeof lib_services_recordExchangeService;
  "lib/services/riskScoringService": typeof lib_services_riskScoringService;
  "lib/session": typeof lib_session;
  "lib/synthetic": typeof lib_synthetic;
  patients: typeof patients;
  records: typeof records;
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
