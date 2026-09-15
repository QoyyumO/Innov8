import { DatabaseReader } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { RecordType } from "../domain";

export const NAME_SEARCH_LIMIT = 20;
export const RECORD_INDEX_LIMIT = 20;

export type FacilityRef = {
  code: string;
  name: string;
};

export type FacilityExistence = FacilityRef & {
  recordTypes: RecordType[];
};

export type PatientSearchHit = {
  publicId: string;
  profile: Doc<"patients">["profile"];
  homeFacility: FacilityRef;
};

export type PatientDiscovery = PatientSearchHit & {
  recordsByFacility: FacilityExistence[];
};

const PUBLIC_ID_PATTERN = /^pat-\d+$/i;

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function isPublicIdQuery(query: string): boolean {
  return PUBLIC_ID_PATTERN.test(query.trim());
}

async function loadFacility(
  db: DatabaseReader,
  facilityId: Id<"facilities">,
): Promise<FacilityRef | null> {
  const facility = await db.get(facilityId);
  if (!facility) {
    return null;
  }
  return { code: facility.code, name: facility.name };
}

async function toSearchHit(
  db: DatabaseReader,
  patient: Doc<"patients">,
): Promise<PatientSearchHit | null> {
  const homeFacility = await loadFacility(db, patient.homeFacilityId);
  if (!homeFacility) {
    return null;
  }
  return {
    publicId: patient.publicId,
    profile: patient.profile,
    homeFacility,
  };
}

async function findPatientByPublicId(
  db: DatabaseReader,
  publicId: string,
): Promise<Doc<"patients"> | null> {
  const normalizedPublicId = publicId.trim().toUpperCase();
  return await db
    .query("patients")
    .withIndex("by_publicId", (query) => query.eq("publicId", normalizedPublicId))
    .unique();
}

export async function loadRecordExistence(
  db: DatabaseReader,
  patientId: Id<"patients">,
): Promise<FacilityExistence[]> {
  const indexes = await db
    .query("recordIndexes")
    .withIndex("by_patientId", (query) => query.eq("patientId", patientId))
    .take(RECORD_INDEX_LIMIT);

  const recordsByFacility: FacilityExistence[] = [];
  for (const recordIndex of indexes) {
    const facility = await loadFacility(db, recordIndex.facilityId);
    if (!facility) {
      continue;
    }
    recordsByFacility.push({
      code: facility.code,
      name: facility.name,
      recordTypes: recordIndex.recordTypes,
    });
  }
  return recordsByFacility;
}

export async function findPatientsByQuery(
  db: DatabaseReader,
  rawQuery: string,
): Promise<PatientSearchHit[]> {
  const trimmed = rawQuery.trim();
  if (trimmed === "") {
    return [];
  }

  if (isPublicIdQuery(trimmed)) {
    const patient = await findPatientByPublicId(db, trimmed);
    if (!patient) {
      return [];
    }
    const hit = await toSearchHit(db, patient);
    return hit ? [hit] : [];
  }

  const searchPrefix = normalizeQuery(trimmed);
  const matches = await db
    .query("patients")
    .withIndex("by_searchName", (query) =>
      query
        .gte("searchName", searchPrefix)
        .lt("searchName", `${searchPrefix}\uffff`),
    )
    .take(NAME_SEARCH_LIMIT);

  const hits: PatientSearchHit[] = [];
  for (const patient of matches) {
    const hit = await toSearchHit(db, patient);
    if (hit) {
      hits.push(hit);
    }
  }
  return hits;
}

export async function getPatientDiscoveryByPublicId(
  db: DatabaseReader,
  publicId: string,
): Promise<PatientDiscovery | null> {
  const patient = await findPatientByPublicId(db, publicId);
  if (!patient) {
    return null;
  }

  const hit = await toSearchHit(db, patient);
  if (!hit) {
    return null;
  }

  return {
    ...hit,
    recordsByFacility: await loadRecordExistence(db, patient._id),
  };
}
