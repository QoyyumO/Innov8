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
import type * as alerts from "../alerts.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as dashboards from "../dashboards.js";
import type * as emergency from "../emergency.js";
import type * as facilityScopeBackfill from "../facilityScopeBackfill.js";
import type * as facilityStatsRecount from "../facilityStatsRecount.js";
import type * as lib_accessRequestMessages from "../lib/accessRequestMessages.js";
import type * as lib_accessWindow from "../lib/accessWindow.js";
import type * as lib_authConstants from "../lib/authConstants.js";
import type * as lib_dashboardConstants from "../lib/dashboardConstants.js";
import type * as lib_demoIds from "../lib/demoIds.js";
import type * as lib_demoUsers from "../lib/demoUsers.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_emergencyConstants from "../lib/emergencyConstants.js";
import type * as lib_facilityScope from "../lib/facilityScope.js";
import type * as lib_facilityStats from "../lib/facilityStats.js";
import type * as lib_invariants from "../lib/invariants.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_publicUser from "../lib/publicUser.js";
import type * as lib_riskConstants from "../lib/riskConstants.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_searchLimits from "../lib/searchLimits.js";
import type * as lib_services_accessControlService from "../lib/services/accessControlService.js";
import type * as lib_services_alertService from "../lib/services/alertService.js";
import type * as lib_services_auditFacilityService from "../lib/services/auditFacilityService.js";
import type * as lib_services_auditLogService from "../lib/services/auditLogService.js";
import type * as lib_services_emergencyAccessService from "../lib/services/emergencyAccessService.js";
import type * as lib_services_patientDiscoveryService from "../lib/services/patientDiscoveryService.js";
import type * as lib_services_recordExchangeService from "../lib/services/recordExchangeService.js";
import type * as lib_services_riskScoringService from "../lib/services/riskScoringService.js";
import type * as lib_services_stepUpService from "../lib/services/stepUpService.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_stepUpConstants from "../lib/stepUpConstants.js";
import type * as lib_synthetic from "../lib/synthetic.js";
import type * as patients from "../patients.js";
import type * as records from "../records.js";
import type * as seed from "../seed.js";
import type * as stepUp from "../stepUp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessRequests: typeof accessRequests;
  alerts: typeof alerts;
  audit: typeof audit;
  auth: typeof auth;
  dashboards: typeof dashboards;
  emergency: typeof emergency;
  facilityScopeBackfill: typeof facilityScopeBackfill;
  facilityStatsRecount: typeof facilityStatsRecount;
  "lib/accessRequestMessages": typeof lib_accessRequestMessages;
  "lib/accessWindow": typeof lib_accessWindow;
  "lib/authConstants": typeof lib_authConstants;
  "lib/dashboardConstants": typeof lib_dashboardConstants;
  "lib/demoIds": typeof lib_demoIds;
  "lib/demoUsers": typeof lib_demoUsers;
  "lib/domain": typeof lib_domain;
  "lib/emergencyConstants": typeof lib_emergencyConstants;
  "lib/facilityScope": typeof lib_facilityScope;
  "lib/facilityStats": typeof lib_facilityStats;
  "lib/invariants": typeof lib_invariants;
  "lib/password": typeof lib_password;
  "lib/publicUser": typeof lib_publicUser;
  "lib/riskConstants": typeof lib_riskConstants;
  "lib/roles": typeof lib_roles;
  "lib/searchLimits": typeof lib_searchLimits;
  "lib/services/accessControlService": typeof lib_services_accessControlService;
  "lib/services/alertService": typeof lib_services_alertService;
  "lib/services/auditFacilityService": typeof lib_services_auditFacilityService;
  "lib/services/auditLogService": typeof lib_services_auditLogService;
  "lib/services/emergencyAccessService": typeof lib_services_emergencyAccessService;
  "lib/services/patientDiscoveryService": typeof lib_services_patientDiscoveryService;
  "lib/services/recordExchangeService": typeof lib_services_recordExchangeService;
  "lib/services/riskScoringService": typeof lib_services_riskScoringService;
  "lib/services/stepUpService": typeof lib_services_stepUpService;
  "lib/session": typeof lib_session;
  "lib/stepUpConstants": typeof lib_stepUpConstants;
  "lib/synthetic": typeof lib_synthetic;
  patients: typeof patients;
  records: typeof records;
  seed: typeof seed;
  stepUp: typeof stepUp;
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
