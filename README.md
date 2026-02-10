# SubmitReady MVP

SubmitReady converts one uploaded receipt (image or PDF) into a reimbursement-ready PDF.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + SQLite (MVP)
- Stripe Checkout + webhook unlock
- OCR extraction: Tesseract.js with PDF first-page render to image
- Server-side PDF generation with `pdf-lib`

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

3. Allow pnpm build scripts for Prisma/Tesseract in your environment (if prompted by pnpm):

```bash
pnpm approve-builds
```

4. Generate Prisma client and push schema:

```bash
pnpm prisma:generate
pnpm prisma:push
```

5. Run dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe test mode setup

1. In Stripe test mode, create a one-time `$9` price and copy `price_...` into `STRIPE_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env`.
3. Start local app and Stripe webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Use Stripe test card `4242 4242 4242 4242` for checkout.

## Test commands

```bash
pnpm test
pnpm lint
```

## Notes

- No user accounts are used in MVP.
- If SMTP is not configured, download links are logged to server output instead of emailed.
- Local file storage uses `/tmp/submitready`. S3-compatible storage is available via env vars.
