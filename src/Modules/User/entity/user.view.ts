import { User } from "./user.model";

export type PublicUser = Pick<
  User,
  "id" | "firstName" | "lastName" | "email" | "role" | "isVerified" | "createdAt" | "updatedAt"
>;

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
