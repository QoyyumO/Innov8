import { v } from "convex/values";
import { userRole } from "./roles";

export const publicUserValidator = v.object({
  _id: v.id("users"),
  email: v.string(),
  roles: v.array(userRole),
  hospital: v.string(),
  department: v.optional(v.string()),
  accountStatus: v.union(v.literal("active"), v.literal("suspended")),
  profile: v.object({
    firstName: v.string(),
    lastName: v.string(),
    middleName: v.optional(v.string()),
  }),
});
