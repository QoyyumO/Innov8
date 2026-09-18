/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_CONSENT_DURATION_MS } from "./lib/consentConstants";
import { loginDemoUser } from "./lib/loginForTests";
import { appErrorCode } from "./lib/appError.testing";
import {
  PERMISSION_DENIED_CODE,
  SESSION_EXPIRED_CODE,
} from "./lib/authConstants";
import {
  CLINICAL_NOTE_TOO_SHORT_CODE,
  CLINICAL_WRITE_NOT_ALLOWED_CODE,
} from "./lib/clinicalNoteConstants";
import type { RecordType } from "./lib/domain";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const NOTE_BODY = "Seen in A&E after authorised access, synthetic note.";
const TRACK_C_TYPES: RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
];

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

async function seedDemoWorld(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) => {
    const abujaId = await ctx.db.insert("facilities", {
      code: "FMC-ABJ",
      name: "FMC Abuja",
      city: "Abuja",
      status: "active",
    });
    const lagosId = await ctx.db.insert("facilities", {
      code: "FMC-LOS",
      name: "FMC Lagos",
      city: "Lagos",
      status: "active",
    });
    const patientId = await ctx.db.insert("patients", {
      publicId: "PAT-002391",
      homeFacilityId: lagosId,
      profile: { firstName: "Chioma", lastName: "Okonkwo" },
      dateOfBirth: Date.UTC(1984, 2, 12),
      gender: "female",
      bloodGroup: "O+",
      searchName: "chioma okonkwo",
    });
    await ctx.db.insert("recordIndexes", {
      patientId,
      facilityId: lagosId,
      recordTypes: TRACK_C_TYPES,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("consents", {
      patientId,
      facilityId: abujaId,
      patientFacilityId: lagosId,
      status: "active",
      note: "Test consent for FMC Abuja",
      grantedAt: Date.now(),
      expiresAt: Date.now() + DEMO_CONSENT_DURATION_MS,
    });
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: lagosId,
      medicalSummary: "SECRET-SUMMARY",
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg"],
      diagnoses: ["Hypertension"],
      conditions: ["Hypertension"],
      updatedAt: Date.now(),
    });
    return { lagosId };
  });
}

async function createAllowRequest(testBackend: TestBackend, token: string) {
  return await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "treatment",
    recordTypes: ["allergies"],
  });
}

describe("appendClinicalNoteAfterAllow", () => {
  test("Ibrahim appends a note after ALLOW and the write is audited", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const created = await createAllowRequest(testBackend, token);
    expect(created.outcome).toBe("ALLOW");

    const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId: created.requestId,
    });
    expect(detail?.canAppendClinicalNote).toBe(true);

    const appended = await testBackend.mutation(
      api.clinicalNotes.appendClinicalNoteAfterAllow,
      { token, requestId: created.requestId, body: `  ${NOTE_BODY}  ` },
    );
    expect(appended).toMatchObject({
      requestId: created.requestId,
      publicId: "PAT-002391",
      originatingFacility: "FMC-ABJ",
      body: NOTE_BODY,
    });

    const notes = await testBackend.query(api.clinicalNotes.listClinicalNotesForRequest, {
      token,
      requestId: created.requestId,
    });
    expect(notes).toEqual([
      { noteId: appended.noteId, body: NOTE_BODY, createdAt: appended.createdAt },
    ]);

    const audit = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(50)).find(
        (event) => event.action === "ClinicalNoteAppended",
      ),
    );
    expect(audit).toMatchObject({
      entity: "accessRequests",
      entityId: created.requestId,
      details: {
        noteId: appended.noteId,
        originatingFacility: "FMC-ABJ",
        noteLength: NOTE_BODY.length,
      },
    });
    expect(JSON.stringify(audit)).not.toContain("SECRET-SUMMARY");
    expect(JSON.stringify(audit?.details)).not.toContain(NOTE_BODY);
  });

  test("nurses, other people's requests, and non-ALLOW decisions cannot write", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const ibrahimRequest = await createAllowRequest(testBackend, ibrahimToken);
    const fatimaRequest = await createAllowRequest(testBackend, fatimaToken);

    await expect(
      testBackend.mutation(api.clinicalNotes.appendClinicalNoteAfterAllow, {
        token: fatimaToken,
        requestId: fatimaRequest.requestId,
        body: NOTE_BODY,
      }),
    ).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));

    await expect(
      testBackend.mutation(api.clinicalNotes.appendClinicalNoteAfterAllow, {
        token: fatimaToken,
        requestId: ibrahimRequest.requestId,
        body: NOTE_BODY,
      }),
    ).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));

    const harvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
    });
    await expect(
      testBackend.mutation(api.clinicalNotes.appendClinicalNoteAfterAllow, {
        token: ibrahimToken,
        requestId: harvest.requestId,
        body: NOTE_BODY,
      }),
    ).rejects.toSatisfy(appErrorCode(CLINICAL_WRITE_NOT_ALLOWED_CODE));

    await expect(
      testBackend.mutation(api.clinicalNotes.appendClinicalNoteAfterAllow, {
        token: ibrahimToken,
        requestId: ibrahimRequest.requestId,
        body: "too short",
      }),
    ).rejects.toSatisfy(appErrorCode(CLINICAL_NOTE_TOO_SHORT_CODE));

    await expect(
      testBackend.mutation(api.clinicalNotes.appendClinicalNoteAfterAllow, {
        token: undefined,
        requestId: ibrahimRequest.requestId,
        body: NOTE_BODY,
      }),
    ).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));
  });
});
