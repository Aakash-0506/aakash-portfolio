# Validation record

Verified on 9 October 2026.

[GitHub Actions build](https://github.com/Aakash-0506/aakash-portfolio/actions/runs/37959159346) passed for source commit `7a04dda35a1b8e9cd2d846e0d1f0bf0a3e7a278f`.

- React production build: passed with Vite.
- Frontend contact-logic tests: 5 passed, 0 failed.
- ASP.NET Core compilation and publish: passed on .NET 10.
- Backend integration tests: 14 passed, 0 failed.
- Published application: uploaded as the workflow artifact `aakash-portfolio`.
- JSON configuration files: parsed successfully.

The integration tests use fake storage and email services. They cover input validation, oversized submissions, spam rejection, store-before-email ordering, storage and email failures, rate limits, liveness and static routing.

Browser visual review and a real SQL/Gmail submission remain unverified because the authoring machine's local Windows runtime could not start. Actual contact delivery requires SQL Server plus private server-side Gmail settings; no credentials are committed.

After configuring a host, send a real contact message and confirm both the SQL row and the email in `aakashgarude@gmail.com`, including Spam. SMTP acceptance does not guarantee inbox placement.
