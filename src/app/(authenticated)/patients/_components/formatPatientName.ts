export function formatPatientName(profile: {
  firstName: string;
  lastName: string;
  middleName?: string;
}): string {
  const parts = [profile.firstName, profile.middleName, profile.lastName].filter(
    (part) => part !== undefined && part.length > 0,
  );
  return parts.join(" ");
}
