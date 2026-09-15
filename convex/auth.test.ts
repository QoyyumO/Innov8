/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { RESET_GENERIC_MESSAGE, RESET_INVALID_TOKEN_MESSAGE } from "./lib/authConstants";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";

function createTest() {
  return convexTest(schema, modules);
}

describe("password reset", () => {
  test("requestPasswordReset does not return a token", async () => {
    const testBackend = createTest();
    await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

    const result = await testBackend.mutation(api.auth.requestPasswordReset, {
      email: IBRAHIM_EMAIL,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe(RESET_GENERIC_MESSAGE);
    expect(result).not.toHaveProperty("resetToken");
  });

  test("dev-reset-token cannot take over an account", async () => {
    const testBackend = createTest();
    await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken: "dev-reset-token",
        newPassword: "hackedpassword",
      }),
    ).rejects.toThrow(RESET_INVALID_TOKEN_MESSAGE);
  });

  test("short password with a bad token is still an invalid token", async () => {
    const testBackend = createTest();
    await expect(
      testBackend.mutation(api.auth.resetPassword, {
        email: IBRAHIM_EMAIL,
        resetToken: "dev-reset-token",
        newPassword: "ab",
      }),
    ).rejects.toThrow(RESET_INVALID_TOKEN_MESSAGE);
  });

  test("issued token can reset once then is rejected", async () => {
    const testBackend = createTest();
    await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

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
    ).rejects.toThrow(RESET_INVALID_TOKEN_MESSAGE);

    const loginResult = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: "newpass1",
    });
    expect(loginResult.success).toBe(true);
  });

  test("expired token is rejected", async () => {
    const testBackend = createTest();
    await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

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
    ).rejects.toThrow(RESET_INVALID_TOKEN_MESSAGE);
  });

  test("public request cooldown does not insert a second token", async () => {
    const testBackend = createTest();
    await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

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
    const loginResult = await testBackend.mutation(api.auth.login, {
      email: IBRAHIM_EMAIL,
      password: DEMO_PASSWORD,
    });

    await testBackend.run(async (ctx) => {
      await ctx.db.patch(loginResult._id, { accountStatus: "suspended" });
    });

    const currentUser = await testBackend.query(api.auth.getCurrentUser, {
      token: loginResult.token,
    });
    expect(currentUser).toBeNull();
  });
});
