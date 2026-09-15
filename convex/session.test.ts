/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import type { AuditAction } from "./lib/domain";
import {
  ADMIN_ROLES,
  CLINICIAN_ROLES,
  SECURITY_ROLES,
  requireRole,
} from "./lib/roles";
import { publicUser, requireSession } from "./lib/session";
import { appendAuditEvent } from "./lib/services/auditLogService";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";

function createTest() {
  return convexTest(schema, modules);
}

async function loginIbrahim() {
  const testBackend = createTest();
  const loginResult = await testBackend.mutation(api.auth.login, {
    email: IBRAHIM_EMAIL,
    password: DEMO_PASSWORD,
  });
  return { testBackend, loginResult };
}

describe("login audit (INN-35)", () => {
  test("writes one UserLoggedIn row tied to the new session", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    const { events, sessions } = await testBackend.run(async (ctx) => ({
      events: await ctx.db.query("auditEvents").collect(),
      sessions: await ctx.db.query("sessions").collect(),
    }));

    expect(sessions).toHaveLength(1);
    expect(sessions[0].token).toBe(loginResult.token);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorId: loginResult._id,
      sessionId: sessions[0]._id,
      action: "UserLoggedIn",
      entity: "sessions",
      entityId: sessions[0]._id,
      details: { email: IBRAHIM_EMAIL },
    });
  });

  test("login response keeps its shape and never includes hashedPassword", async () => {
    const { loginResult } = await loginIbrahim();
    expect(loginResult).not.toHaveProperty("hashedPassword");
    expect(Object.keys(loginResult).sort()).toEqual(
      [
        "_id",
        "accountStatus",
        "department",
        "email",
        "hospital",
        "profile",
        "roles",
        "success",
        "token",
      ].sort(),
    );
  });

  test("failed login writes no audit row", async () => {
    const testBackend = createTest();
    await expect(
      testBackend.mutation(api.auth.login, {
        email: IBRAHIM_EMAIL,
        password: "wrong-password",
      }),
    ).rejects.toThrow("Invalid email or password");

    const events = await testBackend.run((ctx) =>
      ctx.db.query("auditEvents").collect(),
    );
    expect(events).toHaveLength(0);
  });
});

describe("requireSession", () => {
  test("returns the user and session for a valid token", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    const sessionContext = await testBackend.run((ctx) =>
      requireSession(ctx, loginResult.token),
    );
    expect(sessionContext.user._id).toBe(loginResult._id);
    expect(sessionContext.session.token).toBe(loginResult.token);
  });

  test("rejects missing, empty, and unknown tokens", async () => {
    const { testBackend } = await loginIbrahim();
    for (const token of [undefined, "", "not-a-real-token"]) {
      await expect(
        testBackend.run((ctx) => requireSession(ctx, token)),
      ).rejects.toThrow(/session has expired/);
    }
  });

  test("rejects an expired session", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    await testBackend.run(async (ctx) => {
      const session = await ctx.db.query("sessions").first();
      await ctx.db.patch(session!._id, { expiresAt: Date.now() - 1 });
    });
    await expect(
      testBackend.run((ctx) => requireSession(ctx, loginResult.token)),
    ).rejects.toThrow(/session has expired/);
  });

  test("rejects a suspended user even with a live token", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    await testBackend.run((ctx) =>
      ctx.db.patch(loginResult._id, { accountStatus: "suspended" }),
    );
    await expect(
      testBackend.run((ctx) => requireSession(ctx, loginResult.token)),
    ).rejects.toThrow(/suspended/);
  });

  test("rejects a session whose user no longer exists", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    await testBackend.run((ctx) => ctx.db.delete(loginResult._id));
    await expect(
      testBackend.run((ctx) => requireSession(ctx, loginResult.token)),
    ).rejects.toThrow(/session has expired/);
  });

  test("publicUser never includes hashedPassword", async () => {
    const { testBackend, loginResult } = await loginIbrahim();
    const shapedUser = await testBackend.run(async (ctx) =>
      publicUser((await ctx.db.get(loginResult._id))!),
    );
    expect(shapedUser).not.toHaveProperty("hashedPassword");
    expect(shapedUser.email).toBe(IBRAHIM_EMAIL);
  });
});

describe("requireRole", () => {
  test("allows a matching role group and rejects the others", () => {
    const doctor = { roles: ["doctor" as const] };
    const securityOfficer = { roles: ["security_officer" as const] };
    const patient = { roles: ["patient" as const] };

    expect(() => requireRole(doctor, CLINICIAN_ROLES)).not.toThrow();
    expect(() => requireRole(doctor, SECURITY_ROLES)).toThrow(/permission/);
    expect(() => requireRole(doctor, ADMIN_ROLES)).toThrow(/permission/);
    expect(() => requireRole(securityOfficer, SECURITY_ROLES)).not.toThrow();
    expect(() => requireRole(securityOfficer, CLINICIAN_ROLES)).toThrow(
      /permission/,
    );
    expect(() => requireRole(patient, CLINICIAN_ROLES)).toThrow(/permission/);
    expect(() => requireRole({ roles: [] }, CLINICIAN_ROLES)).toThrow(
      /permission/,
    );
  });
});

describe("appendAuditEvent", () => {
  test("inserts with a default createdAt and a trimmed entity", async () => {
    const testBackend = createTest();
    const startedAt = Date.now();
    const auditRow = await testBackend.run(async (ctx) => {
      const auditEventId = await appendAuditEvent(ctx.db, {
        action: "PatientSearched",
        entity: "  patients  ",
        details: { publicId: "PAT-002391" },
      });
      return await ctx.db.get(auditEventId);
    });
    expect(auditRow).toMatchObject({
      action: "PatientSearched",
      entity: "patients",
    });
    expect(auditRow!.createdAt).toBeGreaterThanOrEqual(startedAt);
  });

  test("keeps an explicit createdAt", async () => {
    const testBackend = createTest();
    const auditRow = await testBackend.run(async (ctx) =>
      ctx.db.get(
        await appendAuditEvent(ctx.db, {
          action: "AccessRequested",
          entity: "accessRequests",
          details: {},
          createdAt: 123,
        }),
      ),
    );
    expect(auditRow!.createdAt).toBe(123);
  });

  test("rejects a blank entity", async () => {
    const testBackend = createTest();
    await expect(
      testBackend.run((ctx) =>
        appendAuditEvent(ctx.db, {
          action: "RecordViewed",
          entity: "   ",
          details: {},
        }),
      ),
    ).rejects.toThrow(/entity must not be empty/);
  });

  test("schema rejects an action outside the closed enum", async () => {
    const testBackend = createTest();
    await expect(
      testBackend.run((ctx) =>
        appendAuditEvent(ctx.db, {
          action: "AuditRowDeleted" as AuditAction,
          entity: "auditEvents",
          details: {},
        }),
      ),
    ).rejects.toThrow();
  });

  test("the service exports only an append function", async () => {
    const service = await import("./lib/services/auditLogService");
    const exportedFunctionNames = Object.entries(service)
      .filter(([, exportedValue]) => typeof exportedValue === "function")
      .map(([exportName]) => exportName);
    expect(exportedFunctionNames).toEqual(["appendAuditEvent"]);
  });
});
