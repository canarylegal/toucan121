/**
 * Smoke-test Outlook / Entra config (no interactive login).
 * Usage: npx tsx scripts/smoke-outlook.ts
 */
import "dotenv/config";
import {
  buildOutlookAuthorizeUrl,
  getOutlookEnv,
  isOutlookConfigured,
  OUTLOOK_SCOPES,
} from "../src/lib/calendar/outlook";

async function main() {
  console.log("1) Env loaded?");
  if (!isOutlookConfigured()) {
    console.error("FAIL: MICROSOFT_CLIENT_ID / SECRET missing");
    process.exit(1);
  }
  const env = getOutlookEnv()!;
  console.log("   OK clientId:", env.clientId);
  console.log("   OK tenantId:", env.tenantId);
  console.log("   OK redirectUri:", env.redirectUri);
  console.log("   OK scopes:", OUTLOOK_SCOPES);

  if (!env.redirectUri.startsWith("https://toucan121.co.uk/")) {
    console.error("FAIL: redirectUri should use https://toucan121.co.uk");
    process.exit(1);
  }

  console.log("\n2) Tenant OIDC discovery…");
  const oidc = await fetch(
    `https://login.microsoftonline.com/${env.tenantId}/v2.0/.well-known/openid-configuration`,
  );
  if (!oidc.ok) {
    console.error("FAIL: tenant OIDC", oidc.status);
    process.exit(1);
  }
  console.log("   OK");

  console.log("\n3) Authorize endpoint accepts our client…");
  const authorizeUrl = buildOutlookAuthorizeUrl("smoke-state");
  const res = await fetch(authorizeUrl, { redirect: "manual" });
  // Expect 302 to login.microsoftonline.com login page, or 200 login form
  console.log("   HTTP", res.status);
  if (res.status >= 400) {
    const body = await res.text();
    console.error("FAIL authorize:", body.slice(0, 400));
    process.exit(1);
  }
  // Common failure: AADSTS50011 redirect mismatch shows on the HTML page after follow
  const follow = await fetch(authorizeUrl, { redirect: "follow" });
  const html = await follow.text();
  if (/AADSTS\d+/i.test(html)) {
    const m = html.match(/AADSTS\d+[^<]{0,200}/);
    console.error("FAIL Microsoft error:", m?.[0] ?? "AADSTS in page");
    process.exit(1);
  }
  if (/redirect uri|reply url/i.test(html) && /mismatch|does not match/i.test(html)) {
    console.error("FAIL: redirect URI mismatch — add exactly:");
    console.error("  ", env.redirectUri);
    process.exit(1);
  }
  console.log("   OK (no AADSTS error in authorize flow)");

  console.log("\n4) Public app + Outlook start route…");
  const home = await fetch("https://toucan121.co.uk/");
  console.log("   https://toucan121.co.uk →", home.status);
  const start = await fetch("https://toucan121.co.uk/api/calendar/outlook/start", {
    redirect: "manual",
  });
  // Unauthenticated → redirect to login on APP_URL
  const startLoc = start.headers.get("location") ?? "";
  console.log("   /api/calendar/outlook/start →", start.status, startLoc);
  if (![302, 303, 307, 308].includes(start.status)) {
    console.error("FAIL: expected redirect when logged out");
    process.exit(1);
  }
  if (!startLoc.startsWith("https://toucan121.co.uk/login")) {
    console.error("FAIL: login redirect must use public APP_URL, got:", startLoc);
    process.exit(1);
  }
  console.log("   OK (redirects to public login)");

  console.log("\nPASS: Entra app config looks usable.");
  console.log("Next: sign in at https://toucan121.co.uk → Connect calendar → Outlook");
  console.log("and complete Microsoft consent with a mailbox in this tenant (or guest).");
}

main().catch((err) => {
  console.error("\nFAIL:", err);
  process.exit(1);
});
