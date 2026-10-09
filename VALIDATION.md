# Validation record

Verified on 9 October 2026.

[GitHub Actions run](https://github.com/Aakash-0506/aakash-portfolio/actions/runs/37966551652) passed for application source commit `cd9e3858a5b1a2d48ef5358ecb937a39dea0c526`.

| Check | Result |
| --- | --- |
| React production build | Passed |
| Frontend contact unit tests | 8 passed |
| ASP.NET Core integration/security tests | 27 passed |
| Browser tests | 37 passed |
| Real SQL Server smoke test | 1 passed |
| npm audit | 0 known vulnerabilities |
| NuGet audit, including transitive packages | Passed with advisories and audit-source failures treated as errors |
| Published app and browser report artifacts | Uploaded |

**73 tests passed in total.** The ordinary backend job skips the SQL smoke test because the dedicated SQL job executes it. Two duplicate browser body-limit probes are intentionally skipped; that probe runs once against the shared server.

Browser coverage includes desktop Chromium, mobile Chromium and Firefox. Layout checks cover 320, 390, 768 and 1440 CSS pixels. Automated accessibility checks pass in light and dark themes. Desktop and mobile screenshots were inspected.

The SQL job starts a real isolated SQL Server, executes `database/schema.sql`, verifies SQL-shaped/HTML-shaped Unicode text is stored literally, and confirms a 5,000-character message survives an email-notification failure. Its credentials are generated for the job and masked; the container is removed afterward.

Real Gmail inbox delivery, a deployed production host and the optional Docker image build remain unverified. Automated email states use a fake mailer. Configure production SQL, HTTPS and private Gmail settings, then confirm a real SQL row and email including Spam.

The final documentation commit records these results and removes temporary CI log printing; it does not change the tested application code. Screenshots and traces remain available through the browser-report artifact.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for findings, fixes and scope.
