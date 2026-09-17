import { UserRole } from "./roles";

export const DEMO_PASSWORD = "password123";

/** Chioma's patient-role demo login (linked to PAT-002391 by seed, INN-46). */
export const CHIOMA_EMAIL = "chioma@patient.innov8.ng";

export const DEMO_USERS: Array<{
  email: string;
  roles: UserRole[];
  hospital: string;
  department?: string;
  profile: { firstName: string; lastName: string };
}> = [
  {
    email: "ibrahim@fmc.abuja.ng",
    roles: ["doctor"],
    hospital: "FMC Abuja",
    department: "Cardiology",
    profile: { firstName: "Ibrahim", lastName: "Abdullahi" },
  },
  {
    email: "yusuf@fmc.abeokuta.ng",
    roles: ["doctor"],
    hospital: "FMC Abeokuta",
    department: "General Medicine",
    profile: { firstName: "Yusuf", lastName: "Adewale" },
  },
  {
    email: "security@innov8.ng",
    roles: ["security_officer"],
    hospital: "Innov8 Exchange",
    department: "Security",
    profile: { firstName: "Amina", lastName: "Okeke" },
  },
  {
    email: "fatima@fmc.abuja.ng",
    roles: ["nurse"],
    hospital: "FMC Abuja",
    department: "Emergency",
    profile: { firstName: "Fatima", lastName: "Bello" },
  },
  {
    email: "chinedu@fmc.lagos.ng",
    roles: ["pharmacist"],
    hospital: "FMC Lagos",
    department: "Pharmacy",
    profile: { firstName: "Chinedu", lastName: "Okafor" },
  },
  {
    email: "aisha@fmc.lagos.ng",
    roles: ["laboratory"],
    hospital: "FMC Lagos",
    department: "Pathology",
    profile: { firstName: "Aisha", lastName: "Sule" },
  },
  {
    email: "admin@fmc.abuja.ng",
    roles: ["hospital_admin"],
    hospital: "FMC Abuja",
    department: "Administration",
    profile: { firstName: "Halima", lastName: "Danjuma" },
  },
  {
    email: CHIOMA_EMAIL,
    roles: ["patient"],
    hospital: "FMC Lagos",
    department: "Cardiology",
    profile: { firstName: "Chioma", lastName: "Okonkwo" },
  },
];

/** Healthcare-worker demo emails only — Chioma is a patient account, not a worker. */
export const DEMO_WORKER_SEEDS: Array<{
  email: string;
  workerId: string;
  normalPatientVolume: number;
  normalAccessHours: { start: string; end: string };
}> = [
  {
    email: "ibrahim@fmc.abuja.ng",
    workerId: "WRK-00001",
    normalPatientVolume: 20,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "yusuf@fmc.abeokuta.ng",
    workerId: "WRK-00002",
    normalPatientVolume: 20,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "security@innov8.ng",
    workerId: "WRK-00003",
    normalPatientVolume: 5,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "fatima@fmc.abuja.ng",
    workerId: "WRK-00004",
    normalPatientVolume: 35,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "chinedu@fmc.lagos.ng",
    workerId: "WRK-00005",
    normalPatientVolume: 25,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "aisha@fmc.lagos.ng",
    workerId: "WRK-00006",
    normalPatientVolume: 30,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
  {
    email: "admin@fmc.abuja.ng",
    workerId: "WRK-00007",
    normalPatientVolume: 8,
    normalAccessHours: { start: "08:00", end: "18:00" },
  },
];
