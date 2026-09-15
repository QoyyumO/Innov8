import { DatabaseReader } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { RecordType } from "../domain";
import {
  NAME_PREFIX_MIN_LENGTH,
  NAME_SEARCH_LIMIT,
  RECORD_INDEX_LIMIT,
  isPatientPublicIdQuery,
} from "../searchLimits";

export { NAME_PREFIX_MIN_LENGTH, NAME_SEARCH_LIMIT, RECORD_INDEX_LIMIT };

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

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Exclusive upper bound for a Convex B-tree prefix range: [prefix, end).
 * Successor of the last code unit, so the engine walks only matching keys.
 */
export function btreePrefixExclusiveEnd(prefix: string): string {
  for (let index = prefix.length - 1; index >= 0; index -= 1) {
    const codePoint = prefix.charCodeAt(index);
    if (codePoint < 0xffff) {
      return `${prefix.slice(0, index)}${String.fromCharCode(codePoint + 1)}`;
    }
  }
  return `${prefix}\uffff`;
}

async function loadFacility(
  db: DatabaseReader,
  facilityId: Id<"facilities">,
  facilityCache: Map<Id<"facilities">, FacilityRef | null>,
): Promise<FacilityRef | null> {
  const cached = facilityCache.get(facilityId);
  if (cached !== undefined) {
    return cached;
  }
  const facility = await db.get(facilityId);
  const resolved = facility
    ? { code: facility.code, name: facility.name }
    : null;
  facilityCache.set(facilityId, resolved);
  return resolved;
}

async function toSearchHits(
  db: DatabaseReader,
  patients: Doc<"patients">[],
): Promise<PatientSearchHit[]> {
  const facilityCache = new Map<Id<"facilities">, FacilityRef | null>();
  const hits: PatientSearchHit[] = [];
  for (const patient of patients) {
    const homeFacility = await loadFacility(
      db,
      patient.homeFacilityId,
      facilityCache,
    );
    if (!homeFacility) {
      continue;
    }
    hits.push({
      publicId: patient.publicId,
      profile: patient.profile,
      homeFacility,
    });
  }
  return hits;
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

async function findPatientsBySearchNameEq(
  db: DatabaseReader,
  searchName: string,
): Promise<Doc<"patients">[]> {
  return await db
    .query("patients")
    .withIndex("by_searchName", (query) => query.eq("searchName", searchName))
    .take(NAME_SEARCH_LIMIT);
}

async function findPatientsBySearchNamePrefix(
  db: DatabaseReader,
  prefix: string,
): Promise<Doc<"patients">[]> {
  const exclusiveEnd = btreePrefixExclusiveEnd(prefix);
  return await db
    .query("patients")
    .withIndex("by_searchName", (query) =>
      query.gte("searchName", prefix).lt("searchName", exclusiveEnd),
    )
    .take(NAME_SEARCH_LIMIT);
}

export async function loadRecordExistence(
  db: DatabaseReader,
  patientId: Id<"patients">,
): Promise<FacilityExistence[]> {
  const indexes = await db
    .query("recordIndexes")
    .withIndex("by_patientId", (query) => query.eq("patientId", patientId))
    .take(RECORD_INDEX_LIMIT);

  const facilityCache = new Map<Id<"facilities">, FacilityRef | null>();
  const recordsByFacility: FacilityExistence[] = [];
  for (const recordIndex of indexes) {
    const facility = await loadFacility(
      db,
      recordIndex.facilityId,
      facilityCache,
    );
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

  if (isPatientPublicIdQuery(trimmed)) {
    const patient = await findPatientByPublicId(db, trimmed);
    if (!patient) {
      return [];
    }
    return await toSearchHits(db, [patient]);
  }

  const searchPrefix = normalizeQuery(trimmed);
  if (searchPrefix.length < NAME_PREFIX_MIN_LENGTH) {
    return [];
  }

  const exactNameMatches = await findPatientsBySearchNameEq(db, searchPrefix);
  if (exactNameMatches.length > 0) {
    return await toSearchHits(db, exactNameMatches);
  }

  return await toSearchHits(
    db,
    await findPatientsBySearchNamePrefix(db, searchPrefix),
  );
}

export async function getPatientDiscoveryByPublicId(
  db: DatabaseReader,
  publicId: string,
): Promise<PatientDiscovery | null> {
  const patient = await findPatientByPublicId(db, publicId);
  if (!patient) {
    return null;
  }

  const [hit] = await toSearchHits(db, [patient]);
  if (!hit) {
    return null;
  }

  return {
    ...hit,
    recordsByFacility: await loadRecordExistence(db, patient._id),
  };
}
