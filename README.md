# WellSpring PS13

A hackathon proof of concept for clinician-reviewed pelvic-floor rehabilitation support for older women.

## Current workflow

1. Clinic staff upload TXT, text-based PDF, or DOCX reports, or paste synthetic/de-identified text. Extraction happens in the browser. Scanned PDF OCR is not implemented.
2. The report endpoint organizes explicitly stated information with Gemini when configured; otherwise it returns a clearly labelled local fallback.
3. Educational resources are matched to report keywords. Some topics open YouTube searches for clinician selection.
4. A clinician must approve a case before publishing.
5. An authenticated patient can look up an approved case using the clinic-issued code, submit exercise feedback, and request a single still-image framing review. The image endpoint does not persist the image and does not score exercise technique or determine safety.

## Authentication repair branch

The branch `fix/auth-and-deployment-baseline` adds an application sign-in layer in addition to Vercel deployment protection:

- `POST /api/auth?action=login` checks a configured demo-account list with scrypt password hashes and issues a signed, expiring HttpOnly session cookie.
- `GET /api/auth?action=me` checks the current session.
- `POST /api/auth?action=logout` expires the session cookie.
- The UI shows sign-in until session state is resolved. The patient and clinician workspace is selected from the signed-in role; there is no public role toggle.
- `POST /api/report` requires a clinician session; `POST /api/frame` requires a patient session.
- Case lookup requires a signed-in account. Feedback is patient-role protected. Clinician list/publish/review requires a clinician role and configured clinic token. Missing clinic-token configuration fails closed.

### Required Vercel environment variables

The Vercel project was inspected during this repair and **had zero environment variables configured**. The sign-in page will deliberately refuse to authenticate until the required server-side configuration is set. It does not ship with public demo passwords.

- `AUTH_SESSION_SECRET`: at least 32 random characters; store as a sensitive/encrypted server variable.
- `WELLSPRING_DEMO_ACCOUNTS`: server-side JSON array with at least one patient and one clinician account. Each account needs `id`, `email`, `name`, `role`, `salt`, and `passwordHash`.
- `CLINIC_ADMIN_TOKEN`: strong server-only token for clinician case actions.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required for persistent cases and feedback.
- `GEMINI_API_KEY`: optional; required for actual Gemini report and image calls.

To generate password hashes without putting plaintext passwords in source control:
1. Set `WELLSPRING_CLINICIAN_DEMO_PASSWORD` and `WELLSPRING_PATIENT_DEMO_PASSWORD` in a trusted local shell to unique passwords of at least 12 characters.
2. Run `npm run auth:accounts`; copy its JSON output into the encrypted `WELLSPRING_DEMO_ACCOUNTS` Vercel environment variable. Do not commit or paste that output into chat.
3. Configure the other variables in the Vercel project and redeploy.

Run `supabase/schema.sql` in the intended Supabase project. The schema and actual deployed database must be checked together; having the SQL file in GitHub does not create the database.

## Verification status

- GitHub Actions `npm install` and `npm run build`: passed on this branch (see the PR checks).
- Vercel preview deployment: READY for the latest code available at the time of writing.
- End-to-end browser login: **not yet verified**; Vercel deployment protection blocked automated content fetch.
- Storage integration: **not configured**. Case APIs return 503 until server-side Supabase variables are set.
- Gemini integration: **not confirmed active**; requires `GEMINI_API_KEY`.

## Security and clinical limitations

This login mechanism is a hackathon demo-account store—not a production identity provider, signup/reset, or email-verification system. Although it rejects anonymous requests, the current access-code design does not yet bind each case to a specific patient account in the database. Anyone who has a valid case code and a signed-in account may attempt to look that case up. **Do not use real patient information until per-patient ownership and authorization are implemented and verified.**

Before real clinical use, the system still needs an established identity provider or reviewed account lifecycle, per-patient case ownership, rate limiting, audit logging, secure database policies, retention controls, and applicable privacy/legal/security review. This is not a clinically validated medical device or production clinical-record system. AI must not diagnose, prescribe, or independently clear someone for exercise; external camera views cannot confirm internal pelvic-floor activation.

## Related work

- Draft authentication PR: https://github.com/lingesh-130208/wellspring/pull/1
- Remaining security and ownership checklist: https://github.com/lingesh-130208/wellspring/issues/2
