export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function formatRole(role: string) {
  return role
    .split("_")
    .map((part) => capitalize(part))
    .join(" ");
}
