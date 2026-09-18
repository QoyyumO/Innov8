/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { loginDemoSession, loginDemoUser } from "./lib/loginForTests";
import {
  SESSION_CLEANUP_BATCH,
  SESSION_CLEANUP_MAX_PAGES,
  SESSION_DURATION_MS,
} from "./lib/session";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.useRealTimers();
});

async function countSessions(testBackend: TestBackend) {
  return await testBackend.run(
    async (ctx) => (await ctx.db.query("sessions").take(5000)).length,
  );
}

/** Insert session rows directly, bypassing login's scheduled expiry. */
async function insertSessions(
  testBackend: TestBackend,
  userId: Id<"users">,
  count: number,
  expiresAt: number,
) {
  await testBackend.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      await ctx.db.insert("sessions", {
        userId,
        token: `stale-${index}-${expiresAt}`,
        expiresAt,
        createdAt: expiresAt - SESSION_DURATION_MS,
      });
    }
  });
}

describe("session expiry is materialised (INN-61)", () => {
  test("login schedules the session's own deletion at expiresAt", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);

    const { sessions, scheduled } = await testBackend.run(async (ctx) => ({
      sessions: await ctx.db.query("sessions").take(10),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));

    expect(sessions).toHaveLength(1);
    expect(sessions[0].token).toBe(loginResult.token);
    const expiryJobs = scheduled.filter(
      (job) => job.name === "sessions:expireSession",
    );
    expect(expiryJobs).toHaveLength(1);
    expect(expiryJobs[0]?.scheduledTime).toBe(sessions[0].expiresAt);
  });

  /**
   * The point of the ticket: a subscribed query does not re-run because the
   * clock moved. Expiry has to be a *write*. Asserting the row is gone is
   * what proves a subscriber would be invalidated.
   */
  test("the scheduled job deletes the row, so a read flips without any other write", async () => {
    // Full fake timers, not just Date: the scheduled job has to actually run.
    vi.useFakeTimers();
    const testBackend = createTest();
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    expect(
      await testBackend.query(api.auth.getCurrentUser, { token }),
    ).not.toBeNull();

    vi.advanceTimersByTime(SESSION_DURATION_MS + 1);
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await countSessions(testBackend)).toBe(0);
    expect(
      await testBackend.query(api.auth.getCurrentUser, { token }),
    ).toBeNull();
  });

  test("expireSession leaves a session whose expiry moved, and reschedules", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);

    const sessionId = await testBackend.run(async (ctx) => {
      const session = (await ctx.db.query("sessions").take(1))[0];
      await ctx.db.patch(session._id, {
        expiresAt: Date.now() + 10 * SESSION_DURATION_MS,
      });
      return session._id;
    });

    expect(
      await testBackend.mutation(internal.sessions.expireSession, { sessionId }),
    ).toBe("rescheduled");
    expect(await countSessions(testBackend)).toBe(1);
    expect(
      await testBackend.query(api.auth.getCurrentUser, {
        token: loginResult.token,
      }),
    ).not.toBeNull();
  });

  test("expireSession on an already-deleted session is a no-op", async () => {
    const testBackend = createTest();
    await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const sessionId = await testBackend.run(async (ctx) => {
      const session = (await ctx.db.query("sessions").take(1))[0];
      await ctx.db.delete(session._id);
      return session._id;
    });

    expect(
      await testBackend.mutation(internal.sessions.expireSession, { sessionId }),
    ).toBe("skipped");
  });
});

describe("session cleanup is bounded (INN-64)", () => {
  test("the sweep removes expired rows in batches and reschedules while more remain", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    await insertSessions(testBackend, loginResult._id, 5, Date.now() - 1);

    const firstPage = await testBackend.mutation(
      internal.sessions.sweepExpiredSessions,
      { batchSize: 2 },
    );
    expect(firstPage).toEqual({ deleted: 2, hasMore: true });

    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    // Only the live login session is left; the sweep never touches it.
    const remaining = await testBackend.run(
      async (ctx) => await ctx.db.query("sessions").take(10),
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].token).toBe(loginResult.token);
  });

  test("the sweep leaves unexpired rows alone", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    await insertSessions(testBackend, loginResult._id, 3, Date.now() + 60_000);

    expect(
      await testBackend.mutation(internal.sessions.sweepExpiredSessions, {}),
    ).toEqual({ deleted: 0, hasMore: false });
    expect(await countSessions(testBackend)).toBe(4);
  });

  /**
   * The failure the ticket describes: resetPassword calls
   * deleteAllUserSessions, and an account with a long login history used to
   * read every row with .collect().
   */
  test("a password reset succeeds for a user with far more sessions than one page", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    await insertSessions(
      testBackend,
      loginResult._id,
      SESSION_CLEANUP_BATCH * 3,
      Date.now() + 60_000,
    );
    expect(await countSessions(testBackend)).toBe(SESSION_CLEANUP_BATCH * 3 + 1);

    const issued = await testBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    await testBackend.mutation(api.auth.resetPassword, {
      email: IBRAHIM_EMAIL,
      resetToken: issued!.resetToken,
      newPassword: "a-brand-new-password",
    });

    expect(await countSessions(testBackend)).toBe(0);
    expect(
      await testBackend.query(api.auth.getCurrentUser, {
        token: loginResult.token,
      }),
    ).toBeNull();
  });

  test("changing a password clears other sessions but keeps the caller's", async () => {
    const testBackend = createTest();
    const keep = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    await insertSessions(
      testBackend,
      keep._id,
      SESSION_CLEANUP_BATCH * 2,
      Date.now() + 60_000,
    );

    const changed = await testBackend.mutation(api.auth.changePassword, {
      token: keep.token,
      currentPassword: DEMO_PASSWORD,
      newPassword: "another-new-password",
    });

    const remaining = await testBackend.run(
      async (ctx) => await ctx.db.query("sessions").take(10),
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].token).toBe(changed.token);
    expect(
      await testBackend.query(api.auth.getCurrentUser, { token: keep.token }),
    ).toBeNull();
    expect(
      await testBackend.query(api.auth.getCurrentUser, { token: changed.token }),
    ).not.toBeNull();
  });

  /**
   * The revocation paths, not the internal mutation. Deleting the
   * `scheduler.runAfter` from `deleteAllUserSessions` used to leave the whole
   * suite green while stale sessions survived a password reset for good.
   */
  test("a password reset past the page cap defers the rest and finishes it", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    const overCap = SESSION_CLEANUP_BATCH * SESSION_CLEANUP_MAX_PAGES + 50;
    await insertSessions(testBackend, loginResult._id, overCap, Date.now() + 60_000);

    const issued = await testBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    await testBackend.mutation(api.auth.resetPassword, {
      email: IBRAHIM_EMAIL,
      resetToken: issued!.resetToken,
      newPassword: "a-brand-new-password",
    });

    // The mutation is bounded, so it cannot have cleared everything itself.
    expect(await countSessions(testBackend)).toBeGreaterThan(0);

    await testBackend.finishAllScheduledFunctions(() =>
      vi.advanceTimersByTime(0),
    );
    expect(await countSessions(testBackend)).toBe(0);
  });

  test("a session created before the stamp is rejected even while its row still exists", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    const expiresAt = Date.now() + 60_000;
    const overCap = SESSION_CLEANUP_BATCH * SESSION_CLEANUP_MAX_PAGES + 50;
    await insertSessions(testBackend, loginResult._id, overCap, expiresAt);

    const issued = await testBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    await testBackend.mutation(api.auth.resetPassword, {
      email: IBRAHIM_EMAIL,
      resetToken: issued!.resetToken,
      newPassword: "a-brand-new-password",
    });

    expect(await countSessions(testBackend)).toBeGreaterThan(0);
    expect(
      await testBackend.query(api.auth.getCurrentUser, {
        token: loginResult.token,
      }),
    ).toBeNull();
    expect(
      await testBackend.query(api.auth.getCurrentUser, {
        token: `stale-0-${expiresAt}`,
      }),
    ).toBeNull();
  });

  test("a password change past the page cap defers the rest and keeps the caller's", async () => {
    // Drain only jobs that are already due. Running *all* timers would also
    // fire the caller's own 30-minute expiry - correct behaviour, but not
    // what this test is about.
    vi.useFakeTimers();
    const testBackend = createTest();
    const keep = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    const overCap = SESSION_CLEANUP_BATCH * SESSION_CLEANUP_MAX_PAGES + 50;
    await insertSessions(testBackend, keep._id, overCap, Date.now() + 60_000);

    const changed = await testBackend.mutation(api.auth.changePassword, {
      token: keep.token,
      currentPassword: DEMO_PASSWORD,
      newPassword: "another-new-password",
    });
    expect(await countSessions(testBackend)).toBeGreaterThan(1);

    await testBackend.finishAllScheduledFunctions(() =>
      vi.advanceTimersByTime(0),
    );

    const remaining = await testBackend.run(
      async (ctx) => await ctx.db.query("sessions").take(10),
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].token).toBe(changed.token);
  });

  test("a purge beyond the page cap is continued by a scheduled job", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);
    const overCap = SESSION_CLEANUP_BATCH * SESSION_CLEANUP_MAX_PAGES + 50;
    await insertSessions(testBackend, loginResult._id, overCap, Date.now() + 60_000);

    await testBackend.mutation(internal.sessions.purgeSessionsForUser, {
      userId: loginResult._id,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await countSessions(testBackend)).toBe(0);
  });
});
