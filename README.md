# WellSpring PS13

A hackathon proof of concept for clinician-led pelvic-floor rehabilitation support for older women. The focus is accessible report sharing, clinician-reviewed instructions, patient feedback, and careful separation of AI assistance from clinical decisions.

## Repository structure

- `src/App.tsx` — responsive clinic and patient workflows.
- `src/i18n.ts` — user-interface messages for English, Tamil and Hindi.
- `api/report.ts` — report-topic matching and optional Gemini-powered document organization with explicit local fallback when quota/provider access is unavailable.
- `api/cases.ts` — clinic-token-gated publishing, clinic queue, access-code lookup, and feedback via Supabase REST.
- `api/frame.ts` — optional one-still-image framing observation; no image persistence and no clinical exercise judgement.
- `supabase/schema.sql` — database schema for case persistence and feedback.
- `.github/workflows/build.yml` — TypeScript/Vite build validation on pushes and pull requests.

## Demo workflow

1. Switch to **Clinic**.
2. Load the synthetic report or paste synthetic/de-identified report text.
3. Confirm the synthetic/de-identified data checkbox and request report organization.
4. Review the summary, mentioned terms, safety questions, and any fallback message.
5. An authorized reviewer must independently review and approve a plan. With server configuration, publishing requires the clinic token and writes to Supabase. Without it, the presentation-only case is browser-local and is not durable.
6. Switch to **Patient** and enter the issued case code.
7. Patient learning resources appear only after a clinic-approved report is successfully opened.
8. Submit feedback for clinic review. Feedback does not automatically change the care plan.

## Language and voice

The interface has English, Tamil and Hindi labels. Patient-facing read-aloud uses the browser's Speech Synthesis API and speech language preference; available voices vary by device. Feedback dictation uses the browser Speech Recognition API if present; dictated text is added to the editable field and must be reviewed before submission.

Important: language selection translates supported interface labels, not the clinical content of an uploaded report or clinician plan. It does not silently modify exercise values, dosage, duration or precautions. Clinical content should be provided in a clinician-verified language version before being described as translated/approved.

## AI and ML status

- When `GEMINI_API_KEY` is configured and Gemini responds successfully, `POST /api/report` asks Gemini to organize documented report text into a bounded JSON structure. The output is an assistive draft, not diagnosis, prescription, exercise clearance, or an individualized exercise plan.
- Missing keys, quota exhaustion (HTTP 429), malformed responses or provider errors return an explicitly labelled local fallback. The API does not pretend an AI call succeeded.
- The fallback checks selected keywords to surface *terms appearing in the text*. This is deterministic keyword matching, **not a trained ML model**.
- The frame endpoint can describe visible image framing only when the AI provider is available. It does not observe internal pelvic-floor muscles, score contraction quality, or determine exercise safety.
- No real EMG acquisition pipeline, sensor calibration, labeled clinical dataset, trained classification model, or external validation is included in this repository. Do not describe synthetic/illustrative signals as measured patient data.
- The optional MediaPipe Pose Landmarker uses a real trained computer-vision model to detect visible body landmarks in a still image. It is not trained to detect pelvic-floor contractions, diagnose, score exercise correctness, or establish safety. Image inference occurs in-browser; model/WASM assets load from Google-hosted CDN/model URLs, and MediaPipe may send usage metrics. The app discloses this before use.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run build
npm run dev
```

## Server configuration for a connected demo

Set these server-only environment variables in the hosting platform:

- `GEMINI_API_KEY` — optional; enables AI-assisted report organization and still-frame observations.
- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key; never expose it in browser environment variables.
- `CLINIC_ADMIN_TOKEN` — strong random token for the demo clinic endpoints.

Run `supabase/schema.sql` in the Supabase SQL editor. Do not check environment secrets into GitHub. A clinic token plus a patient access code is a minimal demo gate, not production-grade authentication.

## Endpoints

- `POST /api/report` — report organization, report-topic matching, and explicit fallback status.
- `POST /api/cases?action=publish` — publishes only with clinic authorization and explicit clinician approval.
- `GET /api/cases?code=...` — retrieves an approved, unexpired case by access code.
- `POST /api/cases?action=feedback&code=...` — saves patient feedback.
- `GET /api/cases?action=list` — lists cases for the authorized clinic.
- `POST /api/cases?action=review-feedback` — records clinician feedback review.
- `POST /api/frame` — optional one-time still-image framing review; image is not persisted.

## Security, privacy and clinical limitations

- Hackathon proof of concept only, not a validated medical device or a production clinical-record system.
- Use synthetic or properly de-identified data for demonstrations.
- AI output must not diagnose, prescribe or independently clear someone for exercise.
- ECG or glucose readings alone are not exercise clearance.
- Scanned PDF OCR is not implemented; text extraction is client-side for TXT, text-based PDF and DOCX.
- Individual patient accounts, production-grade role-based authorization, rate limiting, comprehensive audit logs, retention controls, security review, and clinical validation are not implemented.
- A clinician must review original source materials and independently approve any individualized care plan.

## Verification

GitHub Actions runs `npm install` and `npm run build` on pushes and pull requests. The build status must be checked after pushing this branch; source changes alone do not mean the app has been tested or deployed.
