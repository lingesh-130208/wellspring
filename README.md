# WellSpring PS13

A hackathon proof of concept for clinician-reviewed pelvic-floor rehabilitation support for older women.

## Current workflow in the repository

1. Clinic staff upload TXT, text-based PDF, or DOCX reports, or paste text. Extraction occurs in the browser. Scanned PDFs need OCR, which is not implemented yet.
2. The report endpoint organizes explicitly stated information with Gemini when configured; otherwise it returns a clearly labelled local fallback.
3. Educational resources are matched to report keywords. A verified NHS pelvic-floor introduction can play inline; other topics currently open YouTube searches so a clinician can choose an appropriate resource.
4. A clinician must explicitly confirm approval and provide the server-configured clinic token before publishing a case.
5. A patient can use the clinic-issued code to retrieve an approved case, submit feedback, and request a single still-image framing review. The image endpoint does not save the image and does not score exercise technique or determine safety.

## Setup

1. Import this repository into Vercel as a Vite project.
2. Add server-only environment variables:
   - `GEMINI_API_KEY` — optional for AI-assisted report organization and snapshot review.
   - `SUPABASE_URL` — Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase key; never expose it in browser variables.
   - `CLINIC_ADMIN_TOKEN` — a strong random token for clinic-only publishing.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Build using `npm install` and `npm run build`.

## Current endpoints

- `POST /api/report` — report organization and report-matched educational resources.
- `POST /api/cases?action=publish` — publish a case only with clinic token and explicit clinician approval.
- `GET /api/cases?code=...` — retrieve an approved, unexpired case by access code.
- `POST /api/cases?action=feedback&code=...` — save feedback to a case.
- `GET /api/cases?action=list` — clinic-token-protected case list.
- `POST /api/frame` — analyze one still image for framing/quality observations only; does not persist the image.

## Safety, privacy, and limitations

- This is a hackathon proof of concept, not a clinically validated medical device or a production clinical-record system.
- AI output must not diagnose, prescribe, or independently clear someone for exercise.
- ECG or glucose values alone are not exercise clearance.
- Use synthetic or de-identified data for development and demonstrations.
- Do not use DIY electrical-stimulation instructions or make unverified hardware claims.
- A clinic token plus an access code is a minimal demo gate, not production-grade authentication. Before any real clinical use, add individual accounts, robust role-based access control, rate limiting, audit logging, security review, retention controls, and applicable privacy/legal safeguards.
- Automated video matching is keyword-based and only suggests education. It cannot determine that a video or exercise is appropriate for an individual; the clinician must decide.
- Scanned PDF OCR, patient identity/clinic account management, secure production authentication, camera live streaming, and clinical validation are not implemented.

## Verification

A GitHub Actions workflow builds the frontend on each push. Check the latest run in the Actions tab before treating the repository as build-verified.


## Authentication repair branch

This branch adds an application sign-in layer on top of Vercel deployment protection:
- `POST /api/auth?action=login` checks a configured demo-account list using scrypt password hashes and issues an HttpOnly, signed, expiring session cookie.
- `GET /api/auth?action=me` checks whether the current request has a valid session.
- `POST /api/auth?action=logout` expires the session cookie.
- The React app shows a sign-in screen until the session is resolved. Patient and clinician workspaces are separated by the signed-in account role.
- `POST /api/report` and `POST /api/frame` require role-appropriate sessions.
- Case lookup and feedback require a signed-in session; clinician list/publish/review require a clinician session and the configured clinic token.

### Required server configuration

The sign-in feature will deliberately remain unavailable until all required configuration exists. It does not ship with public demo passwords.

- `AUTH_SESSION_SECRET`: at least 32 random characters, stored only as a Vercel encrypted/sensitive server environment variable.
- `WELLSPRING_DEMO_ACCOUNTS`: server-only JSON array containing account IDs, emails, names, role, salt and scrypt password hashes for at least one `patient` and one `clinician`.
- `CLINIC_ADMIN_TOKEN`: strong server-only token required for clinician case mutations.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only storage configuration for persisted cases and feedback.
- `GEMINI_API_KEY`: optional server-side key for real AI report/image processing.

Generate password hashes without putting plaintext passwords in the repository:
1. Set `WELLSPRING_CLINICIAN_DEMO_PASSWORD` and `WELLSPRING_PATIENT_DEMO_PASSWORD` in a trusted local environment to unique passwords of at least 12 characters.
2. Run `npm run auth:accounts` in that environment. It prints the hashed account configuration; copy that output directly into the encrypted `WELLSPRING_DEMO_ACCOUNTS` Vercel environment variable. Do not commit the output.
3. Configure a strong `AUTH_SESSION_SECRET` and the remaining server secrets in the Vercel project environment, then redeploy. Never paste secrets into chat or store them in source control.

The auth account list is a small hackathon demonstration account store, not a signup, password-reset, email-verification, or production identity-management system. Do not use it with real patient records. Production deployment requires an established identity provider, per-user case ownership/authorization, secure database policies, rate limiting, audit logging and a privacy/security review.

