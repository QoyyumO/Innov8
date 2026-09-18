/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD, DEMO_USERS } from "./lib/demoUsers";
import {
  CURRENT_PASSWORD_INCORRECT_CODE,
  INVALID_CREDENTIALS_MESSAGE,
  RESET_GENERIC_MESSAGE,
  RESET_INVALID_TOKEN_CODE,
} from "./lib/authConstants";
import { appErrorCode } from "./lib/appError.testing";
import { ensureDemoUsersForTests, loginDemoSession } from "./lib/loginForTests";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";

function createTest() {
  return convexTest(schema, modules);
}

async function seedIbrahimLogin(testBackend: ReturnType<typeof createTest>) {
  await loginDemoSession(testBackend, IBRAHIM_EMAIL);
}

describe("login (INN-57)", () => {
  test("does not create missing demo users", async () => {
    const testBackend = createTest();
    const loginResult = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });
    expect(loginResult).toEqual({
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
    const userCount = await testBackend.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      return users.length;
    });
    expect(userCount).toBe(0);
  });

  test("a suspended demo account stays suspended", async () => {
    const testBackend = createTest();
    await ensureDemoUsersForTests(testBackend);
    await testBackend.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", IBRAHIM_EMAIL))
        .unique();
      if (!user) {
        throw new Error("Expected Ibrahim after ensureDemoUsers");
      }
      await ctx.db.patch(user._id, { accountStatus: "suspended" });
    });

    const firstLogin = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });
    const secondLogin = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });
    expect(firstLogin).toEqual({
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
    expect(secondLogin).toEqual({
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });

    const accountStatus = await testBackend.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", IBRAHIM_EMAIL))
        .unique();
      return user?.accountStatus;
    });
    expect(accountStatus).toBe("suspended");
  });

  test("successful login does not insert extra users", async () => {
    const testBackend = createTest();
    await ensureDemoUsersForTests(testBackend);
    const usersBefore = await testBackend.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      return users.length;
    });
    expect(usersBefore).toBe(DEMO_USERS.length);

    const loginResult = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });
    expect(loginResult.success).toBe(true);

    const usersAfter = await testBackend.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      return users.length;
    });
    expect(usersAfter).toBe(DEMO_USERS.length);
  });
});

describe("password reset", () => {
  test("requestPasswordReset does not return a token", async () => {
    const testBackend = createTest();
    await seedIbrahimLogin(testBackend);

    const result = await testBackend.mutation(api.auth.requestPasswordReset, {
      email: IBRAHIM_EMAIL,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe(RESET_GENERIC_MESSAGE);
    expect(result).not.toHaveProperty("resetToken");
  });

  test("dev-reset-token cannot take over an account", async () => {
    const testBackend = createTest();
    await seedIbrahimLogin(testBackend);

    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken: "dev-reset-token",
        newPassword: "hackedpassword",
      }),
    ).rejects.toSatisfy(appErrorCode(RESET_INVALID_TOKEN_CODE));
  });

  test("short password with a bad token is still an invalid token", async () => {
    const testBackend = createTest();
    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken: "dev-reset-token",
        newPassword: "ab",
      }),
    ).rejects.toSatisfy(appErrorCode(RESET_INVALID_TOKEN_CODE));
  });

  test("issued token can reset once then is rejected", async () => {
    const testBackend = createTest();
    await seedIbrahimLogin(testBackend);

    const issued = await testBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    const resetToken = issued?.resetToken ?? "";
    expect(resetToken.length).toBeGreaterThan(0);

    await testBackend.mutation(api.auth.resetPassword, {
      email: IBRAHIM_EMAIL,
      resetToken,
      newPassword: "newpass1",
    });

    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken,
        newPassword: "newpass2",
      }),
    ).rejects.toSatisfy(appErrorCode(RESET_INVALID_TOKEN_CODE));

    const loginResult = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: "newpass1",
    });
    expect(loginResult.success).toBe(true);
  });

  test("expired token is rejected", async () => {
    const testBackend = createTest();
    await seedIbrahimLogin(testBackend);

    const issued = await testBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    const resetToken = issued?.resetToken ?? "";
    expect(resetToken.length).toBeGreaterThan(0);

    await testBackend.run(async (ctx) => {
      const tokenRows = await ctx.db.query("passwordResetTokens").collect();
      for (const tokenRow of tokenRows) {
        await ctx.db.patch(tokenRow._id, { expiresAt: Date.now() - 1 });
      }
    });

    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken,
        newPassword: "newpass1",
      }),
    ).rejects.toSatisfy(appErrorCode(RESET_INVALID_TOKEN_CODE));
  });

  test("public request cooldown does not insert a second token", async () => {
    const testBackend = createTest();
    await seedIbrahimLogin(testBackend);

    await testBackend.mutation(api.auth.requestPasswordReset, {
      email: IBRAHIM_EMAIL,
    });
    await testBackend.mutation(api.auth.requestPasswordReset, {
      email: IBRAHIM_EMAIL,
    });

    const tokenCount = await testBackend.run(async (ctx) => {
      const tokenRows = await ctx.db.query("passwordResetTokens").collect();
      return tokenRows.length;
    });
    expect(tokenCount).toBe(1);
  });
});

describe("session account status", () => {
  test("getCurrentUser returns null for a suspended account", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);

    await testBackend.run(async (ctx) => {
      await ctx.db.patch(loginResult._id, { accountStatus: "suspended" });
    });

    const currentUser = await testBackend.query(api.auth.getCurrentUser, {
      token: loginResult.token,
    });
    expect(currentUser).toBeNull();
  });
});

describe("account mutation audit events", () => {
  test("audits logout, profile update, password change, and password reset", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);

    await testBackend.mutation(api.auth.updateProfile, {
      token: loginResult.token,
      profile: { firstName: "Ibrahim", lastName: "Updated" },
    });
    const changed = await testBackend.mutation(api.auth.changePassword, {
      token: loginResult.token,
      currentPassword: DEMO_PASSWORD,
      newPassword: "changedpass1",
    });
    await testBackend.mutation(api.auth.logout, { token: changed.token });

    const resetBackend = createTest();
    await loginDemoSession(resetBackend, IBRAHIM_EMAIL);
    const issued = await resetBackend.mutation(
      internal.auth.issuePasswordResetToken,
      { email: IBRAHIM_EMAIL },
    );
    const resetToken = issued?.resetToken ?? "";
    await resetBackend.mutation(api.auth.resetPassword, {
      email: IBRAHIM_EMAIL,
      resetToken,
      newPassword: "resetpass1",
    });

    const events = await testBackend.run(async (ctx) =>
      ctx.db.query("auditEvents").take(20),
    );
    expect(events.map((event) => event.action)).toEqual([
      "UserLoggedIn",
      "ProfileUpdated",
      "PasswordChanged",
      "UserLoggedOut",
    ]);
    expect(events.filter((event) => event.action === "ProfileUpdated")).toHaveLength(1);
    expect(events.filter((event) => event.action === "PasswordChanged")).toHaveLength(1);
    expect(events.filter((event) => event.action === "UserLoggedOut")).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("changedpass1");
    expect(JSON.stringify(events)).not.toContain(loginResult.token);

    const resetEvents = await resetBackend.run(async (ctx) =>
      ctx.db.query("auditEvents").take(20),
    );
    expect(resetEvents.filter((event) => event.action === "PasswordReset")).toHaveLength(1);
    expect(JSON.stringify(resetEvents)).not.toContain(resetToken);
    expect(
      await resetBackend.run(async (ctx) => ctx.db.query("sessions").take(20)),
    ).toHaveLength(0);
  });

  test("failed password change and invalid reset do not write those audit actions", async () => {
    const testBackend = createTest();
    const loginResult = await loginDemoSession(testBackend, IBRAHIM_EMAIL);

    await expect(
      testBackend.mutation(api.auth.changePassword, {
        token: loginResult.token,
        currentPassword: "wrong-password",
        newPassword: "changedpass1",
      }),
    ).rejects.toSatisfy(appErrorCode(CURRENT_PASSWORD_INCORRECT_CODE));

    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken: "not-a-real-token",
        newPassword: "resetpass1",
      }),
    ).rejects.toSatisfy(appErrorCode(RESET_INVALID_TOKEN_CODE));

    const events = await testBackend.run(async (ctx) =>
      ctx.db.query("auditEvents").take(20),
    );
    expect(events.map((event) => event.action)).toEqual(["UserLoggedIn"]);
  });
});
