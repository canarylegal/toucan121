# Toucan 121

A free scheduling app for one-to-one meetings. Hosts connect Outlook or CalDAV; guests book from a public profile without creating an account.

Live: [toucan121.co.uk](https://toucan121.co.uk)

## Run locally

Needs Node 22 and Postgres.

```bash
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js, Prisma, Postgres. Optional Outlook and Google host calendars; Google host connect is off until Google Cloud verification.

## Licence

Toucan 121 is open source under the [MIT License](./LICENSE).
