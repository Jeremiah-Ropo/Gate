import { randomBytes } from "crypto";

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const generateUniqueSuffix = (length = 6): string => randomBytes(length).toString("hex").slice(0, length);
