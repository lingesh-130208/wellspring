# WellSpring PS13

A hackathon proof of concept for clinician-reviewed pelvic-floor rehabilitation support for older women.

## Current workflow

1. Clinic staff upload TXT, text-based PDF, or DOCX reports, or paste synthetic/de-identified text. Extraction happens in the browser. Scanned PDF OCR is not implemented.
2. The report endpoint organizes explicitly stated information with Gemini when configured; otherwise it returns a clearly labelled local fallback.
3. Educational resources are matched to report keywords. Some topics open YouTube searches for clinician selection.
4. A clinician must approve a case before publishing.
5. A clinician assigns each approved case to a configured patient account. The signed-in patient must own that case to view it or submit feedback.
6. The patient workspace offers browser-based live pose landmarks for visible shoulder/hip framing cues. The model runs in the browser after loading from a CDN; the app does not upload or record the live camera stream. This is not an exercise-correctness or internal muscle-activation detector.
7. The optional still-image review uses MediaPipe Pose Landmarker in the browser to estimate visible shoulder/hip framing. The image is not uploaded by this feature. It does not score exercise technique or determine safety.
8. The clinic feedback queue polls every 15 seconds while the clinician workspace is open and the clinic authorization token is active.

## Accessibility and innovation features

- Browser speech recognition can dictate report notes and patient feedback where the browser supports it and microphone permission is granted. Manual typing remains available.
- Read-aloud controls use the browser speech synthesis engine for clinician-approved patient plans. The accessibility toolbar includes larger text, a high-contrast toggle, and English/Tamil voice-guidance selection.
- Patient activity is shown as a color-coded timeline of self-reported events (completed, difficulty/discomfort, pain, and other feedback). It is explicitly not a vital-sign display or validated clinical risk score; numeric symptom ratings are patient-reported only.
- An optional session reminder can trigger an in-app reminder while the page is open, and a browser notification if permission is granted. It is not a medication or emergency reminder and does not run when the browser is closed.
- Soft depth and frosted-card styling are paired with keyboard focus outlines, responsive layouts, and large tap targets.
- The camera feature uses MediaPipe Pose Landmarker Lite to estimate visible body landmarks for framing cues. It is an ML vision model, not a pelvic-floor contraction detector or clinical movement assessment.

## Authentication repair branch

The branch `fix/auth-and-deployment-baseline` adds an application sign-in layer in addition to Vercel deployment protection:

- `POST /api/auth?action=login` checks a configured demo-account list with scrypt password hashes and issues a signed, expiring HttpOnly session cookie.
- `GET /api/auth?action=me` checks the current session.
- `POST /api/auth?action=logout` expires the session cookie.
- The UI shows sign-in until session state is resolved. The patient and clinician workspace is selected from the signed-in role; there is no public role toggle.
- `POST /api/report` requires a clinician session; `POST /api/frame` requires a patient session.
- Clinician case list/publish/review and patient-account listing require a clinician session plus the clinic token.
- Case publication assigns a configured patient account; patient lookup and feedback verify the case's `patient_account_id` against the signed-in session.
- The clinic feedback queue refreshes every 15 seconds while active.

### Required Vercel environment variables

The Vercel preview for `fix/auth-and-deployment-baseline` now has the three authentication variables configured for demo-only clinician and patient accounts. The production environment is not changed by those preview-only values. Supabase storage and Gemini remain unconfigured, so persistent case workflows and Gemini-backed report processing are not yet live.

- `AUTH_SESSION_SECRET`: at least 32 random characters; store as a sensitive/encrypted server variable.
- `WELLSPRING_DEMO_ACCOUNTS`: server-side JSON array with at least one patient and one clinician account. Each account needs `id`, `email`, `name`, `role`, `salt`, and `passwordHash`.
- `CLINIC_ADMIN_TOKEN`: strong server-only token for clinician case actions.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required for persistent cases and feedback. These are still missing in the current Vercel project.
- `GEMINI_API_KEY`: optional; required for Gemini-assisted report organization. It is not required for the on-device MediaPipe camera or still-image framing tools. This key is still missing in the current Vercel project.
- Live camera framing uses MediaPipe Pose Landmarker in the browser and loads the WASM/model assets from public CDNs. Camera permission and an internet connection are required the first time.

To generate password hashes without putting plaintext passwords in source control:
1. Set `WELLSPRING_CLINICIAN_DEMO_PASSWORD` and `WELLSPRING_PATIENT_DEMO_PASSWORD` in a trusted local shell to unique passwords of at least 12 characters.
2. Run `npm run auth:accounts`; copy its JSON output into the encrypted `WELLSPRING_DEMO_ACCOUNTS` Vercel environment variable. Do not commit or paste that output into chat.
3. Configure the other variables in the Vercel project and redeploy.

Run `supabase/schema.sql` in the intended Supabase project. The schema and actual deployed database must be checked together; having the SQL file in GitHub does not create the database.

## Verification status

- GitHub Actions `npm test` and `npm run build`: passed on the latest checked branch commit (see the PR checks).
- Vercel preview deployment: READY for the latest code available at the time of writing.
- End-to-end browser login: **not yet verified**; Vercel deployment protection blocked automated content fetch.
- Storage integration: **not configured**. Case APIs return 503 until server-side Supabase variables are set and `supabase/schema.sql` is applied.
- Gemini integration: **not configured**; report processing falls back to a clearly labelled local summary until `GEMINI_API_KEY` is set.
- Live camera and still-image ML model: deployment build passed; camera permission, CDN model download, microphone permissions, speech synthesis, and device reminder behavior still need hands-on browser tests.

## Security and clinical limitations

This login mechanism is a hackathon demo-account store—not a production identity provider, signup/reset, or email-verification system. The case API now stores `patient_account_id` and checks ownership for patient lookups and feedback. Apply the updated `supabase/schema.sql` before using this workflow. Existing records with a null owner are intentionally not accessible to patient accounts until an authorized migration/reassignment is performed. Do not use real patient information.

Before real clinical use, the system still needs an established identity provider or reviewed account lifecycle, per-patient case ownership, rate limiting, audit logging, secure database policies, retention controls, and applicable privacy/legal/security review. This is not a clinically validated medical device or production clinical-record system. AI must not diagnose, prescribe, or independently clear someone for exercise; external camera views cannot confirm internal pelvic-floor activation.

## Related work

- Draft authentication PR: https://github.com/lingesh-130208/wellspring/pull/1
- Remaining security and ownership checklist: https://github.com/lingesh-130208/wellspring/issues/2
