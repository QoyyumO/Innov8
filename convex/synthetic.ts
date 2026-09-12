// Shared helpers for generating synthetic (never real) demo data.
// Deterministic PRNG so re-running seeding is reproducible; combined with
// idempotent lookups in seed.ts, re-running never duplicates rows.

export function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export const FIRST_NAMES = [
  "Chidinma", "Emeka", "Ngozi", "Tunde", "Amaka", "Kunle", "Ifeoma", "Segun",
  "Adaeze", "Bola", "Chiamaka", "Obinna", "Funmilayo", "Uche", "Grace",
  "Yemi", "Blessing", "Chukwuemeka", "Halima", "Musa", "Aisha", "Suleiman",
  "Zainab", "Abdullahi", "Fatima", "Ibrahim", "Hauwa", "Nasir", "Maryam",
  "Sadiq", "Temitope", "Damilola", "Oluwaseun", "Adebayo", "Folake", "Kelechi",
] as const;

export const LAST_NAMES = [
  "Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Abubakar", "Nwosu",
  "Ibrahim", "Bello", "Chukwu", "Danjuma", "Okoro", "Yusuf", "Suleiman",
  "Adewale", "Musa", "Okeke", "Aliyu", "Ogunleye", "Sani", "Mohammed",
  "Nnaji", "Abdullahi", "Olawale", "Onyekwere", "Garba", "Umar", "Chinwe",
] as const;

export const CONDITIONS = [
  "Hypertension", "Type 2 Diabetes Mellitus", "Malaria", "Asthma",
  "Peptic Ulcer Disease", "Sickle Cell Anaemia (trait)", "Chronic Kidney Disease",
  "Osteoarthritis", "Typhoid Fever", "Community-Acquired Pneumonia",
  "Benign Prostatic Hyperplasia", "Gestational Diabetes", "Migraine",
  "Tuberculosis (treated)", "Iron-Deficiency Anaemia",
] as const;

export const RECORD_TYPES = ["lab", "imaging", "prescription", "visit_note"] as const;

export const ACCESS_REASONS = [
  "Scheduled follow-up consultation",
  "Emergency department admission review",
  "Lab result review",
  "Medication reconciliation",
  "Referral from another facility",
  "Routine chart review",
  "Discharge summary preparation",
] as const;

export const WORKER_ROLE_POOL = [
  "doctor",
  "nurse",
  "pharmacist",
  "laboratory",
] as const;

export const SPECIALTIES: Record<string, string[]> = {
  doctor: ["Cardiology", "General Medicine", "Paediatrics", "Obstetrics & Gynaecology", "Surgery"],
  nurse: ["Emergency", "Ward Nursing", "Intensive Care", "Maternity"],
  pharmacist: ["Pharmacy"],
  laboratory: ["Pathology", "Haematology"],
};

export const ALERT_TYPES = [
  "unauthorized_access",
  "off_hours_access",
  "excessive_volume",
  "cross_facility_access",
] as const;

export const AUDIT_ACTIONS = [
  "view_record",
  "export_record",
  "login",
  "update_record",
] as const;

export function isoDateOfBirth(rand: () => number): string {
  const year = randInt(rand, 1945, 2023);
  const month = randInt(rand, 1, 12);
  const day = randInt(rand, 1, 28);
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

// Facility codes must match the demo `hospital` strings already used
// in convex/auth.ts's DEMO_USERS.
export const FACILITIES = [
  { code: "FMC-LOS", name: "FMC Lagos", city: "Lagos" },
  { code: "FMC-ABJ", name: "FMC Abuja", city: "Abuja" },
  { code: "FMC-ABK", name: "FMC Abeokuta", city: "Abeokuta" },
] as const;
