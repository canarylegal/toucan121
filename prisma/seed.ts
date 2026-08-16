import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_WEEKDAY_WINDOWS } from "../src/lib/availability";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "colin@example.com";
  const passwordHash = await hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Colin",
      passwordHash,
      host: {
        create: {
          email,
          name: "Colin",
          slug: "colin",
          timezone: "Europe/London",
          meetingTypes: {
            create: [
              {
                slug: "intro-call",
                title: "Intro call",
                description: "A short video introduction.",
                durationMins: 30,
                locationType: "VIDEO",
                availabilityJson: JSON.stringify(DEFAULT_WEEKDAY_WINDOWS),
              },
              {
                slug: "coffee",
                title: "Coffee meetup",
                description: "In-person networking coffee.",
                durationMins: 45,
                locationType: "IN_PERSON",
                locationNote: "To be confirmed",
                availabilityJson: JSON.stringify(DEFAULT_WEEKDAY_WINDOWS),
              },
            ],
          },
        },
      },
    },
    include: { host: { include: { meetingTypes: true } } },
  });

  console.log("Seeded user:", user.email);
  console.log("Password: password123");
  console.log("Host slug:", user.host?.slug);
  console.log("Profile URL: /colin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
