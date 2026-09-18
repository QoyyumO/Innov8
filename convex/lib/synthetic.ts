import {
  BloodGroup,
  Gender,
  Purpose,
  RecordType,
} from "./domain";
import { UserRole } from "./roles";

export function mulberry32(seed: number) {
  let state = seed;
  return function rand() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed =
      (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<Item>(
  rand: () => number,
  items: readonly Item[],
): Item {
  if (items.length === 0) {
    throw new Error("pick() requires a non-empty list");
  }
  return items[Math.floor(rand() * items.length)] as Item;
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function normalizeSearchName(
  firstName: string,
  lastName: string,
  middleName?: string,
): string {
  const parts = [firstName, middleName, lastName].filter(
    (part) => part !== undefined && part.length > 0,
  );
  return parts.join(" ").toLowerCase();
}

export function unixDateOfBirth(rand: () => number): number {
  const year = randInt(rand, 1945, 2023);
  const month = randInt(rand, 0, 11);
  const day = randInt(rand, 1, 28);
  return Date.UTC(year, month, day);
}

export const FIRST_NAMES = [
  "Chidinma",
  "Emeka",
  "Ngozi",
  "Tunde",
  "Amaka",
  "Kunle",
  "Ifeoma",
  "Segun",
  "Adaeze",
  "Bola",
  "Chiamaka",
  "Obinna",
  "Funmilayo",
  "Uche",
  "Grace",
  "Yemi",
  "Blessing",
  "Chukwuemeka",
  "Halima",
  "Musa",
  "Aisha",
  "Suleiman",
  "Zainab",
  "Abdullahi",
  "Fatima",
  "Ibrahim",
  "Hauwa",
  "Nasir",
  "Maryam",
  "Sadiq",
  "Temitope",
  "Damilola",
  "Oluwaseun",
  "Adebayo",
  "Folake",
  "Kelechi",
] as const;

export const LAST_NAMES = [
  "Okafor",
  "Adeyemi",
  "Okonkwo",
  "Balogun",
  "Eze",
  "Abubakar",
  "Nwosu",
  "Ibrahim",
  "Bello",
  "Chukwu",
  "Danjuma",
  "Okoro",
  "Yusuf",
  "Suleiman",
  "Adewale",
  "Musa",
  "Okeke",
  "Aliyu",
  "Ogunleye",
  "Sani",
  "Mohammed",
  "Nnaji",
  "Abdullahi",
  "Olawale",
  "Onyekwere",
  "Garba",
  "Umar",
  "Chinwe",
] as const;

export const CONDITIONS = [
  "Hypertension",
  "Type 2 Diabetes Mellitus",
  "Malaria",
  "Asthma",
  "Peptic Ulcer Disease",
  "Sickle Cell Anaemia (trait)",
  "Chronic Kidney Disease",
  "Osteoarthritis",
  "Typhoid Fever",
  "Community-Acquired Pneumonia",
  "Benign Prostatic Hyperplasia",
  "Gestational Diabetes",
  "Migraine",
  "Tuberculosis (treated)",
  "Iron-Deficiency Anaemia",
] as const;

export const MEDICATIONS = [
  "Lisinopril 10mg",
  "Metformin 500mg",
  "Amlodipine 5mg",
  "Salbutamol inhaler",
  "Omeprazole 20mg",
  "Paracetamol 500mg",
  "Losartan 50mg",
  "Atorvastatin 20mg",
] as const;

export const ALLERGIES = [
  "Penicillin",
  "Sulfa drugs",
  "NSAIDs",
  "Peanuts",
  "Latex",
] as const;

export const RECORD_TYPES: readonly RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
];

export const PURPOSES: readonly Purpose[] = [
  "treatment",
  "emergency",
  "referral",
  "follow-up",
  "administrative",
];

export const NORMAL_PURPOSES: readonly Purpose[] = [
  "treatment",
  "follow-up",
  "referral",
];

export const BLOOD_GROUPS: readonly BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "unknown",
];

export const GENDERS: readonly Gender[] = [
  "female",
  "male",
  "other",
  "unknown",
];

export const WORKER_ROLE_POOL: readonly UserRole[] = [
  "doctor",
  "nurse",
  "pharmacist",
  "laboratory",
  "hospital_admin",
  "security_officer",
];

export const DEPARTMENTS: Record<UserRole, string[]> = {
  doctor: [
    "Cardiology",
    "General Medicine",
    "Paediatrics",
    "Obstetrics & Gynaecology",
    "Surgery",
  ],
  nurse: ["Emergency", "Ward Nursing", "Intensive Care", "Maternity"],
  pharmacist: ["Pharmacy"],
  laboratory: ["Pathology", "Haematology"],
  hospital_admin: ["Administration"],
  system_admin: ["Administration"],
  security_officer: ["Security"],
  patient: ["Cardiology"],
};

export const FACILITIES = [
  { code: "FMC-LOS", name: "FMC Lagos", city: "Lagos", status: "active" as const },
  { code: "FMC-ABJ", name: "FMC Abuja", city: "Abuja", status: "active" as const },
  { code: "FMC-ABK", name: "FMC Abeokuta", city: "Abeokuta", status: "active" as const },
];

export { DEMO_PATIENT_PUBLIC_ID } from "./demoIds";
export const DEMO_PATIENT_INDEX = 2391;
export const DEMO_PATIENT_DOB_MS = Date.UTC(1988, 3, 12);

/**
 * Demo-scale seed defaults. Historical §14 volumes overflow the Convex
 * free plan — do not use SECTION_14_* as defaults.
 */
export const SEED_WORKER_COUNT = 24;
export const SEED_PATIENT_COUNT = 200;
export const SEED_ACCESS_EVENT_COUNT = 200;

/** Full §14 volumes for a paid-plan or throwaway preview only (INN-73). */
export const SECTION_14_WORKER_COUNT = 500;
export const SECTION_14_PATIENT_COUNT = 10_000;
export const SECTION_14_ACCESS_EVENT_COUNT = 100_000;
export const SEED_PATIENT_BATCH_SIZE = 50;
export const SEED_ACCESS_EVENT_BATCH_SIZE = 50;
export const SEED_CLEAR_BATCH_SIZE = 100;

export const SEED_EVENT_BASE_MS = Date.UTC(2026, 5, 1);
export const DEMO_ALLOW_REQUESTED_AT = SEED_EVENT_BASE_MS - 2000;
export const DEMO_BLOCK_REQUESTED_AT = SEED_EVENT_BASE_MS - 1000;

export const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
