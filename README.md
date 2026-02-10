# SubmitReady MVP

SubmitReady converts one uploaded receipt (image or PDF) into a reimbursement-ready PDF.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + Postgres
- Stripe Checkout + webhook unlock
- OCR extraction: Tesseract.js (local) with graceful fallback to manual review on Vercel
- Server-side PDF generation with `pdf-lib`
- Storage: local (dev), Vercel Blob (hosted), or S3-compatible

## Features implemented

- Landing page with required trust copy + upload CTA
- Upload page accepting JPG/PNG/HEIC/PDF up to 10MB
- Pluggable extraction layer with confidence scoring (vendor/date/total)
- Preview page with inline watermarked PDF and confidence-driven field correction
- Stripe Checkout (`$9` via your Stripe Price ID) and webhook payment unlock
- Download page + optional email delivery with 24-hour time-limited link
- Deterministic PDF template titled "Expense Reimbursement Submission"
- Basic IP-based upload rate limiting middleware
- Minimal tests for PDF determinism and Stripe webhook signature verification

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Copy env template:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` to a running Postgres database.

4. Push schema and generate Prisma client:

```bash
pnpm prisma:push
```

5. Run dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vercel required env vars

Set these in your Vercel project settings:

- `DATABASE_URL` (hosted Postgres)
- `STORAGE_DRIVER=blob`
- `BLOB_READ_WRITE_TOKEN` (from Vercel Blob)
- `APP_URL` (your deployment URL)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- Optional SMTP vars for outbound email

## Stripe test mode setup

1. In Stripe test mode, create a one-time `$9` price and copy `price_...` into `STRIPE_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Use Stripe test card `4242 4242 4242 4242`.

## Test commands

```bash
pnpm test
pnpm lint
```

## Notes

- No user accounts are used in MVP.
- If SMTP is not configured, download links are logged to server output instead of emailed.
