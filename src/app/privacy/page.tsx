import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { ToucanBrand } from "@/components/toucan-brand";

export const metadata: Metadata = {
  title: `Privacy · ${APP_NAME}`,
  description: `How ${APP_NAME} collects, uses, and stores personal data for booking and account emails.`,
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      `${APP_NAME} (toucan121.co.uk) is a scheduling service for one-to-one meetings. This policy explains what personal data we process when you use the website, book a meeting, host a profile, or receive related emails.`,
      "If you have privacy questions, email colin@toucan121.co.uk with the subject line “Privacy”.",
    ],
  },
  {
    title: "What data we collect",
    body: [
      "Account holders: name, email address, password (stored as a hash), optional profile details (slug, bio, photo), timezone, calendar connection settings, and meeting-type preferences.",
      "Booking guests: name, email address, chosen meeting time, optional notes or venue, and any reminder preferences you set when booking or accepting an invite.",
      "Hosts may also store action points and completion notes after a meeting.",
      "Technical data such as server logs may include IP address, browser type, and timestamps when you use the site.",
    ],
  },
  {
    title: "Why we use your data",
    body: [
      "To provide the service you asked for: create bookings, show availability, sync calendar events where a host has connected a calendar, and send transactional emails about those bookings and your account.",
      "Transactional emails include invitations, confirmations, reschedules, cancellations, meeting reminders, email verification, password reset, and connection requests between accounts.",
      "We do not sell personal data. We do not send marketing newsletters or promotional campaigns.",
    ],
  },
  {
    title: "Legal bases",
    body: [
      "Where you create an account or book a meeting, we process data to perform that contract (or steps you request before a contract).",
      "We also process data where needed for our legitimate interests in running a secure booking service, preventing abuse, and improving reliability — balanced against your rights.",
      "Where required, we rely on your consent for optional reminder preferences you choose when booking or accepting an invite. You can stop reminder emails using the link in those messages.",
    ],
  },
  {
    title: "Emails and consent",
    body: [
      "When you enter your email to book a meeting, accept an invitation, or create an account, you receive emails that are necessary to complete and manage that request (for example confirmation, time changes, and cancellations).",
      "Optional appointment reminders can be turned off when booking, when accepting an invite, by the host for that visitor booking, or later via the stop-reminders link in a reminder email.",
      "Hosts receive operational emails about meetings on their profile because they operate that profile.",
    ],
  },
  {
    title: "Sharing and processors",
    body: [
      "Hosts see guest booking details for meetings on their profile. Guests see host profile and meeting details needed for the appointment.",
      "We use infrastructure and email delivery providers to run the service (for example hosting and SMTP). They process data only to provide those services to us.",
      "If a host connects Outlook, CalDAV, or another calendar, booking details needed for the event may be written to that calendar under the host’s account with that provider.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We keep booking and account records while your account is active and for as long as needed to provide history, support, and security.",
      "You may ask us to delete account data where applicable; some records may be retained where we must keep them for legal, security, or dispute reasons.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Depending on where you live, you may have rights to access, correct, delete, or restrict processing of your personal data, and to object to certain processing.",
      "To exercise these rights, contact us at colin@toucan121.co.uk with the subject “Privacy”.",
      "You may also complain to your local data protection authority (in the UK, the Information Commissioner’s Office).",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable technical and organisational measures to protect personal data, including hashed passwords and access controls on production systems. No method of transmission or storage is completely secure.",
    ],
  },
  {
    title: "Children",
    body: [
      `${APP_NAME} is not directed at children under 16. Please do not use the service to provide personal data of children without appropriate authority.`,
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update this policy from time to time. The “Last updated” date below will change when we do. Continued use of the service after an update means you should review the revised policy.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 21 August 2026</p>
      <p className="mt-4 text-muted">
        This policy describes how {APP_NAME} handles personal information for
        booking and accounts.
      </p>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-line bg-panel p-5"
          >
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
              {section.body.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link href="/about" className="font-medium text-accent underline">
          About {APP_NAME}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/" className="font-medium text-accent underline">
          Home
        </Link>
      </p>
    </main>
  );
}
