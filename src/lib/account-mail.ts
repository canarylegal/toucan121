import { sendAuthEmail } from "@/lib/email";
import { renderNoticeEmail } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";
import { appBaseUrl, issueEmailToken } from "@/lib/email-tokens";

export async function sendVerifyEmailForUser(user: {
  id: string;
  email: string;
  name: string;
}): Promise<void> {
  const raw = await issueEmailToken(user.id, "EMAIL_VERIFY");
  const url = `${appBaseUrl()}/verify/${raw}`;
  const mail = renderNoticeEmail({
    subject: `Confirm your ${APP_NAME} email`,
    title: "Confirm your email",
    greeting: `Hi ${user.name},`,
    intro: `Please confirm this is your email so you can host and add connections on ${APP_NAME}.`,
    primaryCta: { label: "Confirm email", url },
    footerNote:
      "This link expires in 7 days. If you did not create an account, you can ignore this message.",
  });
  await sendAuthEmail({
    to: user.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
