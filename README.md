# WellSpring PS13

A hackathon proof of concept for clinician-reviewed pelvic-floor rehabilitation support for older women.

## Intended workflow

1. A clinic user uploads an existing report.
2. AI extracts and organizes only information stated in the report.
3. The system prepares a clinician-facing rehabilitation-plan draft for review and approval.
4. A patient uses an access code to view the approved plan, submit a single camera snapshot for exercise-session feedback, and send session feedback to the clinic.

## Safety and scope

- This is a hackathon proof of concept, not a clinically validated medical device or a production clinical-record system.
- AI output is a draft for clinician review; it must not diagnose, prescribe, or independently clear someone for exercise.
- ECG or glucose values alone are not exercise clearance.
- Use synthetic or de-identified data for development and demonstrations.
- No DIY electrical-stimulation instructions or unverified hardware claims.

## Development status

The existing AppDeploy prototype is a reference for the workflow. This repository is being prepared for a portable implementation with an independently configured backend, database, and AI provider. Features must be labeled as implemented, tested, simulated, or proposed accurately.
