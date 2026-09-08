export type AccessDecision = "ALLOW" | "VERIFY" | "BLOCK";

export type DummyRequest = {
  id: string;
  patientId: string;
  patientName: string;
  facility: string;
  purpose: string;
  recordTypes: string;
  decision: AccessDecision;
  risk: number;
  time: string;
};

export type DummyAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  time: string;
};

export const DEMO_PATIENT = {
  id: "PAT-002391",
  name: "Chioma Okonkwo",
  homeFacility: "FMC Lagos",
  visitingFacility: "FMC Abuja",
};

export const doctorRequests: DummyRequest[] = [
  {
    id: "REQ-1042",
    patientId: DEMO_PATIENT.id,
    patientName: DEMO_PATIENT.name,
    facility: "FMC Lagos",
    purpose: "Treatment",
    recordTypes: "Summary, allergies, medications, diagnoses",
    decision: "ALLOW",
    risk: 8,
    time: "Today, 09:14",
  },
  {
    id: "REQ-1048",
    patientId: "PAT-002410",
    patientName: "Bola Adeyemi",
    facility: "FMC Lagos",
    purpose: "Follow-up",
    recordTypes: "Medical summary",
    decision: "VERIFY",
    risk: 41,
    time: "Today, 10:02",
  },
  {
    id: "REQ-1101",
    patientId: "500 records",
    patientName: "Bulk harvest attempt",
    facility: "Multiple",
    purpose: "Administrative",
    recordTypes: "Full record set",
    decision: "BLOCK",
    risk: 94,
    time: "Today, 10:21",
  },
];

export const nurseRequests: DummyRequest[] = [
  {
    id: "REQ-2101",
    patientId: DEMO_PATIENT.id,
    patientName: DEMO_PATIENT.name,
    facility: "FMC Lagos",
    purpose: "Treatment",
    recordTypes: "Allergies, medications",
    decision: "ALLOW",
    risk: 11,
    time: "Today, 08:40",
  },
  {
    id: "REQ-2104",
    patientId: "PAT-002188",
    patientName: "Hassan Musa",
    facility: "FMC Abuja",
    purpose: "Treatment",
    recordTypes: "Nursing notes",
    decision: "ALLOW",
    risk: 6,
    time: "Today, 09:05",
  },
  {
    id: "REQ-2110",
    patientId: "PAT-002512",
    patientName: "Ngozi Eze",
    facility: "FMC Lagos",
    purpose: "Follow-up",
    recordTypes: "Vitals history",
    decision: "VERIFY",
    risk: 36,
    time: "Today, 09:48",
  },
];

export const pharmacistRequests: DummyRequest[] = [
  {
    id: "REQ-3102",
    patientId: DEMO_PATIENT.id,
    patientName: DEMO_PATIENT.name,
    facility: "FMC Lagos",
    purpose: "Treatment",
    recordTypes: "Active medications, allergies",
    decision: "ALLOW",
    risk: 9,
    time: "Today, 08:55",
  },
  {
    id: "REQ-3108",
    patientId: "PAT-002077",
    patientName: "Tunde Balogun",
    facility: "FMC Lagos",
    purpose: "Referral",
    recordTypes: "Prescription history",
    decision: "VERIFY",
    risk: 33,
    time: "Today, 09:30",
  },
];

export const laboratoryRequests: DummyRequest[] = [
  {
    id: "REQ-4103",
    patientId: DEMO_PATIENT.id,
    patientName: DEMO_PATIENT.name,
    facility: "FMC Lagos",
    purpose: "Treatment",
    recordTypes: "Lab results existence",
    decision: "ALLOW",
    risk: 10,
    time: "Today, 08:20",
  },
  {
    id: "REQ-4112",
    patientId: "PAT-001904",
    patientName: "Amina Sule",
    facility: "FMC Abeokuta",
    purpose: "Follow-up",
    recordTypes: "Pathology reports",
    decision: "BLOCK",
    risk: 78,
    time: "Today, 09:16",
  },
];

export const securityAlerts: DummyAlert[] = [
  {
    id: "ALT-01",
    title: "Mass-record harvest blocked",
    detail: "Dr. Ibrahim requested 500 patient records. Risk 94/100. BLOCK.",
    severity: "high",
    time: "Today, 10:21",
  },
  {
    id: "ALT-02",
    title: "Break-glass used",
    detail: "Temporary emergency access granted for PAT-002391. 15 minutes remaining.",
    severity: "medium",
    time: "Today, 10:28",
  },
  {
    id: "ALT-03",
    title: "After-hours access",
    detail: "Laboratory request from FMC Abeokuta outside usual hours.",
    severity: "low",
    time: "Yesterday, 22:14",
  },
];

export const patientAccessEvents = [
  {
    id: "VIEW-01",
    actor: "Dr. Ibrahim Abdullahi",
    facility: "FMC Abuja",
    purpose: "Treatment",
    fields: "Medical summary, allergies, medications",
    time: "Today, 09:14",
  },
  {
    id: "VIEW-02",
    actor: "Nurse Fatima Bello",
    facility: "FMC Abuja",
    purpose: "Treatment",
    fields: "Allergies, medications",
    time: "Today, 08:40",
  },
];
