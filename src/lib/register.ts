import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_WEEKDAY_WINDOWS } from "@/lib/availability";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { isValidSuffix, randomSlugSuffix, slugify } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";

/** Account signup — hosting is optional and configured later. */
export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(160),
    password: z.string().min(8).max(128),
    passwordConfirm: z.string().min(1).max(128),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const enableHostingSchema = z.object({
  name: z.string().trim().min(1).max(80),
  businessName: z.string().trim().max(120).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default("Europe/London")
    .refine(isValidTimezone, "Choose a valid timezone"),
  suffix: z.string().trim().max(48).optional(),
});

function normalizeSuffixInput(
  suffix: string | undefined,
  name: string,
): string {
  const raw = (suffix ?? "").trim().toLowerCase();
  if (!raw) return name;
  if (!isValidSuffix(raw)) {
    throw new Error(
      "Suffix must be lowercase letters, numbers, hyphens, or full stops (e.g. jane.smith)",
    );
  }
  if (isReservedSlug(raw)) {
    throw new Error("That profile address is reserved — please choose another");
  }
  return raw;
}

async function uniqueSuffix(desired: string): Promise<string> {
  let candidate = slugify(desired);
  if (!isValidSuffix(candidate)) {
    candidate = slugify(desired.replace(/\./g, "-"));
  }
  if (isReservedSlug(candidate)) {
    candidate = `${candidate}-page`;
  }
  const base = candidate;
  for (let i = 0; i < 8; i++) {
    if (isReservedSlug(candidate)) {
      candidate = `${base}-${randomSlugSuffix()}`;
      continue;
    }
    const existing = await prisma.host.findUnique({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
    candidate = `${base}-${randomSlugSuffix()}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function registerUser(input: z.infer<typeof signupSchema>) {
  const data = signupSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with that email already exists");
  }

  const passwordHash = await hash(data.password, 12);

  return prisma.user.create({
    data: {
      email,
      name: data.name,
      passwordHash,
    },
  });
}

/** Opt-in: create a public host profile + default meeting type. */
export async function enableHosting(
  userId: string,
  input: z.infer<typeof enableHostingSchema>,
) {
  const data = enableHostingSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Account not found");

  const existingHost = await prisma.host.findUnique({
    where: { userId },
  });
  if (existingHost) {
    throw new Error("Hosting is already enabled for this account");
  }

  const slug = await uniqueSuffix(
    normalizeSuffixInput(data.suffix, data.name),
  );
  const businessName = (data.businessName ?? "").trim();

  return prisma.host.create({
    data: {
      userId: user.id,
      email: user.email,
      name: data.name,
      businessName,
      slug,
      timezone: data.timezone,
      meetingTypes: {
        create: {
          slug: "meeting",
          title: "Meeting",
          description: "A 30-minute meeting.",
          durationMins: 30,
          locationType: "VIDEO",
          availabilityJson: JSON.stringify(DEFAULT_WEEKDAY_WINDOWS),
        },
      },
    },
  });
}
