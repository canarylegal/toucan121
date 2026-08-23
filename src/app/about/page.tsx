import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, GITHUB_REPO_URL } from "@/lib/brand";
import { ToucanBrand } from "@/components/toucan-brand";

export const metadata: Metadata = {
  title: `About · ${APP_NAME}`,
  description: `What ${APP_NAME} is, what makes it different, and which calendars are supported.`,
};

const differences: { title: string; body: string }[] = [
  {
    title: "Greater control",
    body: "Hosts can filter booking requests, including manual approval before a time is confirmed.",
  },
  {
    title: "Two-way booking",
    body: "Visitors and hosts can both start a meeting. You can also log appointments that were already made in person, by phone, or by email.",
  },
  {
    title: "Action points",
    body: "After the meeting, add what you agreed and check items off as they are done.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "What is a 121?",
    a: "A one-to-one meeting — just you and the other person. Toucan is for those, whether they are video calls or in person.",
  },
  {
    q: "Do I need an account to book?",
    a: "No. Guests book from a host’s public profile with a name and email. Create an account if you want to host, save your details, or connect your own calendar.",
  },
  {
    q: "Which calendars work?",
    a: "Hosts connect Outlook or CalDAV (including iCloud / Apple Calendar). Google Calendar for hosts is not available yet — that waits on Google’s approval. Guests never connect a calendar: the booking email includes an invite that works in Google, Apple, Outlook, and other apps that open .ics files.",
  },
  {
    q: "Video or in person?",
    a: "Hosts choose that on each meeting type. Video can use Toucan’s call link, or a Zoom / Teams / Meet URL you already use.",
  },
  {
    q: "Is it free?",
    a: "Yes. Toucan 121 is a free, open source alternative to Calendly.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">About</h1>

      <section className="mt-8 rounded-lg border border-line bg-panel p-5">
        <h2 className="font-serif text-2xl tracking-tight">
          What makes Toucan 121 different?
        </h2>
        <ul className="mt-4 space-y-4">
          {differences.map((item) => (
            <li key={item.title} className="text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">
                {item.title}.{" "}
              </span>
              {item.body}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-muted">
        Brief answers. Create an account when you are ready to host or book with
        your details saved.
      </p>

      <dl className="mt-6 space-y-6">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="rounded-lg border border-line bg-panel p-5"
          >
            <dt className="font-semibold">{item.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 rounded-lg border border-line bg-panel p-5">
        <h2 className="font-serif text-2xl tracking-tight">Open source</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {APP_NAME} is free open-source software. You can browse the code,
          report issues, suggest improvements, or run your own instance from
          the repository on GitHub.
        </p>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-semibold text-accent underline"
        >
          View on GitHub
        </a>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-line bg-panel px-5 py-3 text-sm font-semibold hover:bg-accent-soft"
        >
          Sign in
        </Link>
        <Link
          href="/privacy"
          className="rounded-md border border-line bg-panel px-5 py-3 text-sm font-semibold hover:bg-accent-soft"
        >
          Privacy
        </Link>
      </div>
    </main>
  );
}
