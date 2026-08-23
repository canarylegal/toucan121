import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_WEEKDAY_WINDOWS } from "@/lib/availability";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { isValidSuffix, randomSlugSuffix, slugify } from "@/lib/slug";
import { isValidTimezone } from "@/lib/timezones";
import { sendVerifyEmailForUser } from "@/lib/account-mail";

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

  const user = await prisma.user.create({
    data: {
      email,
      name: data.name,
      passwordHash,
    },
  });
  await sendVerifyEmailForUser(user).catch((err) =>
    console.error("[signup] verify email", err),
  );
  return user;
}

/** Opt-in: public links profile without booking. */
export async function enableLinksProfile(
  userId: string,
  input: z.infer<typeof enableHostingSchema>,
) {
  const data = enableHostingSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Account not found");
  if (!user.emailVerifiedAt) {
    throw new Error(
      "Confirm your email before you publish a profile — check your inbox.",
    );
  }

  const existingHost = await prisma.host.findUnique({
    where: { userId },
  });
  const businessName = (data.businessName ?? "").trim();

  if (existingHost?.hostingActive && !existingHost.bookingEnabled) {
    throw new Error("Your links profile is already live");
  }
  if (existingHost?.hostingActive && existingHost.bookingEnabled) {
    throw new Error("Full hosting is already enabled for this account");
  }

  if (existingHost) {
    await prisma.$transaction([
      prisma.host.update({
        where: { id: existingHost.id },
        data: {
          hostingActive: true,
          bookingEnabled: false,
          name: data.name,
          businessName,
          timezone: data.timezone,
          profileLayoutMode: "LINKS_FIRST",
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { hostingPreference: "LINKS" },
      }),
    ]);
    return prisma.host.findUniqueOrThrow({ where: { id: existingHost.id } });
  }

  const slug = await uniqueSuffix(
    normalizeSuffixInput(data.suffix, data.name),
  );

  return prisma.$transaction(async (tx) => {
    const host = await tx.host.create({
      data: {
        userId: user.id,
        email: user.email,
        name: data.name,
        businessName,
        slug,
        timezone: data.timezone,
        hostingActive: true,
        bookingEnabled: false,
        profileLayoutMode: "LINKS_FIRST",
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { hostingPreference: "LINKS" },
    });
    return host;
  });
}

async function ensureDefaultMeetingType(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  hostId: string,
) {
  const count = await tx.meetingType.count({
    where: { hostId, deletedAt: null },
  });
  if (count > 0) return;
  await tx.meetingType.create({
    data: {
      hostId,
      slug: "meeting",
      title: "Meeting",
      description: "A 30-minute meeting.",
      durationMins: 30,
      locationType: "VIDEO",
      availabilityJson: JSON.stringify(DEFAULT_WEEKDAY_WINDOWS),
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
  if (!user.emailVerifiedAt) {
    throw new Error(
      "Confirm your email before you start hosting — check your inbox.",
    );
  }

  const existingHost = await prisma.host.findUnique({
    where: { userId },
  });
  const businessName = (data.businessName ?? "").trim();
  if (existingHost?.hostingActive && existingHost.bookingEnabled) {
    throw new Error("Hosting is already enabled for this account");
  }
  if (existingHost) {
    await prisma.$transaction(async (tx) => {
      await tx.host.update({
        where: { id: existingHost.id },
        data: {
          hostingActive: true,
          bookingEnabled: true,
          name: data.name,
          businessName,
          timezone: data.timezone,
        },
      });
      await ensureDefaultMeetingType(tx, existingHost.id);
      await tx.user.update({
        where: { id: userId },
        data: { hostingPreference: "HOST" },
      });
    });
    return prisma.host.findUniqueOrThrow({ where: { id: existingHost.id } });
  }

  const slug = await uniqueSuffix(
    normalizeSuffixInput(data.suffix, data.name),
  );

  return prisma.$transaction(async (tx) => {
    const host = await tx.host.create({
      data: {
        userId: user.id,
        email: user.email,
        name: data.name,
        businessName,
        slug,
        timezone: data.timezone,
        hostingActive: true,
        bookingEnabled: true,
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
    await tx.user.update({
      where: { id: user.id },
      data: { hostingPreference: "HOST" },
    });
    return host;
  });
}

export async function activateBookingForHost(hostId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.host.update({
      where: { id: hostId },
      data: { bookingEnabled: true },
    });
    await ensureDefaultMeetingType(tx, hostId);
    const host = await tx.host.findUniqueOrThrow({
      where: { id: hostId },
      select: { userId: true },
    });
    await tx.user.update({
      where: { id: host.userId },
      data: { hostingPreference: "HOST" },
    });
  });
}
