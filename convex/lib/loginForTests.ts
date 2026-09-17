import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { DEMO_PASSWORD } from "./demoUsers";

type DemoAuthMutation =
  | typeof internal.auth.ensureDemoUsers
  | typeof api.auth.login;

type DemoAuthCaller = {
  mutation: (
    functionReference: DemoAuthMutation,
    args: object,
  ) => Promise<unknown>;
};

function asDemoAuthCaller(testBackend: unknown): DemoAuthCaller {
  return testBackend as DemoAuthCaller;
}

export async function ensureDemoUsersForTests<TBackend>(testBackend: TBackend) {
  await asDemoAuthCaller(testBackend).mutation(
    internal.auth.ensureDemoUsers,
    {},
  );
}

export async function loginDemoSession<TBackend>(
  testBackend: TBackend,
  email: string,
) {
  const backend = asDemoAuthCaller(testBackend);
  await backend.mutation(internal.auth.ensureDemoUsers, {});
  const loginResult = await backend.mutation(api.auth.login, {
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

export async function loginDemoUser<TBackend>(
  testBackend: TBackend,
  email: string,
) {
  const loginResult = await loginDemoSession(testBackend, email);
  return loginResult.token;
}
