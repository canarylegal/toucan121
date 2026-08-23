/**
 * One-shot: send a password-reset email using the running app code.
 * Usage: npx tsx scripts/send-password-reset.ts [email]
 */
import { prisma } from "../src/lib/db";
import { sendAuthEmail } from "../src/lib/email";
import { renderNoticeEmail } from "../src/lib/email-templates";
import { APP_NAME } from "../src/lib/brand";
import { appBaseUrl, issueEmailToken } from "../src/lib/email-tokens";

async function main() {
  const email = (process.argv[2] ?? "colin@mcwilliamslegal.co.uk")
    .trim()
    .toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    console.error("no user");
    process.exit(1);
  }
  const raw = await issueEmailToken(user.id, "PASSWORD_RESET");
  const url = `${appBaseUrl()}/reset/${raw}`;
  console.log("reset_url", url);
  const mail = renderNoticeEmail({
    subject: `Reset your ${APP_NAME} password`,
    title: "Reset your password",
    greeting: `Hi ${user.name},`,
    intro: `Use the button below to choose a new password for your ${APP_NAME} account.`,
    primaryCta: { label: "Choose a new password", url },
    footerNote:
      "This link expires in 1 hour. If you did not ask for a reset, you can ignore this message.",
  });
  await sendAuthEmail({
    to: user.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.log("sent", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
