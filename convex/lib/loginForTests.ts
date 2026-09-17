import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { DEMO_PASSWORD } from "./demoUsers";

type LoginTestBackend = {
  mutation: (functionReference: unknown, args: unknown) => Promise<unknown>;
};

export async function ensureDemoUsersForTests(testBackend: LoginTestBackend) {
  await testBackend.mutation(internal.auth.ensureDemoUsers, {});
}

export async function loginDemoSession(
  testBackend: LoginTestBackend,
  email: string,
) {
  await ensureDemoUsersForTests(testBackend);
  const loginResult = await testBackend.mutation(api.auth.login, {
    email,
    password: DEMO_PASSWORD,
  });
  if (
    typeof loginResult !== "object" ||
    loginResult === null ||
    !("token" in loginResult) ||
    typeof loginResult.token !== "string" ||
    !("_id" in loginResult)
  ) {
    throw new Error(`Login failed for ${email}`);
  }
  return loginResult as {
    success: true;
    token: string;
    _id: Id<"users">;
  };
}

export async function loginDemoUser(
  testBackend: LoginTestBackend,
  email: string,
) {
  const loginResult = await loginDemoSession(testBackend, email);
  return loginResult.token;
}
