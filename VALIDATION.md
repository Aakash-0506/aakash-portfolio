# Validation record

Verified on 10 October 2026.

[GitHub Actions run](https://github.com/Aakash-0506/aakash-portfolio/actions/runs/38023722556) passed for application source commit `ac084fbbd5c8f5a58000eeae5eb0095353247602`.

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

Browser coverage includes desktop Chromium, mobile Chromium and Firefox. Layout checks cover 320, 390, 768 and 1440 CSS pixels. Automated accessibility checks pass in light and dark themes, including the expanded project walkthrough. Desktop and mobile screenshots were inspected.

The SQL job starts a real isolated SQL Server, executes `database/schema.sql`, verifies SQL-shaped/HTML-shaped Unicode text is stored literally, and confirms a 5,000-character message survives an email-notification failure. Its credentials are generated for the job and masked; the container is removed afterward.

Real Gmail inbox delivery, a deployed production host and the optional Docker image build remain unverified. Automated email states use a fake mailer. Configure production SQL, HTTPS and private Gmail settings, then confirm a real SQL row and email including Spam.

The final documentation commit records these results and removes temporary CI log printing; it does not change the tested application code. Screenshots and traces remain available through the browser-report artifact.

## Design and content refinement

- Put Aakash’s name and aspiring full-stack developer focus in the hero.
- Explain the technologies through features of the actual portfolio, without employment or proficiency claims.
- Present the contact flow as an accessible ordered walkthrough: interface, API, storage and notification.
- Keep the project-details target mounted while collapsed so its control has a stable relationship.
- Increase mobile form text to 16px and icon/navigation controls to 44px.
- Preserve the warm palette, dark theme, reduced-motion support and existing contact behavior.
- Describe Gmail as notification support without claiming verified inbox delivery.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for findings, fixes and scope.
