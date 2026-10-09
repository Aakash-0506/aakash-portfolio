# Bug and security review

Reviewed on 9 October 2026.

## Corrections

| Area | Reproduced issue | Correction |
| --- | --- | --- |
| API request errors | Malformed requests became 500 errors in Development. | Preserve BadHttpRequestException's 400/413/415 status and return a safe JSON response. |
| API routing | An unsupported contact content type selected the API catch-all and returned 404. | Exclude API paths from the SPA fallback and let routing return 415. |
| Contact abuse | Rotating IP addresses bypassed per-IP limits and could start many SQL/SMTP operations. | Add a constant global budget and concurrency cap before the IP-specific limiter. |
| Contact feedback | Returned field errors were discarded; truthy strings could appear successful. | Display known field errors and require explicit boolean delivery states with the expected HTTP status. |
| Keyboard use | Mobile menu links were skipped after opening, and Escape lost focus. | Focus the first menu link on opening and return focus to the toggle on Escape. |
| Mobile layout | The hero's minimum content width caused overflow at 320px. | Let the grid shrink, wrap the heading and clip its decorative artwork. |
| Readability | Accent and miniature text failed automated contrast checks. | Darken the relevant light-theme colors and correct the dark .NET label. |
| Request timeout | AbortSignal.timeout was required even where the build's browser baseline did not provide it. | Use AbortController and clean up the timeout after every result. |

## Protections checked

- SQL inserts use typed parameters. A real SQL Server smoke test stores SQL-shaped text literally and verifies the table still exists.
- User text stays in React text/input values; no HTML-rendering sink is used for submitted data.
- Email recipient is fixed, Reply-To is parsed by MimeKit, and name/subject/email controls are rejected.
- No real Gmail credential or production SQL password is committed. CI uses a random, masked password for its temporary database.
- Content Security Policy restricts scripts and connections to the site, blocks object embedding and framing, and allows only the font hosts used by the design.
- Error responses do not expose stack traces, SQL configuration or internal exceptions.
- npm audit checks the committed dependency tree; NuGet audit includes transitive packages and fails the build on advisories or audit-source errors.

## Scope and remaining setup

Tests run the production application locally on GitHub Actions. Real Gmail inbox delivery requires the owner's private credentials and remains unverified. Configure HTTPS, a trusted SQL certificate, least-privilege database access and explicitly trusted forwarded headers on the production host.

The contact form is anonymous. Limits reduce abuse; they do not identify visitors or guarantee that every submission is legitimate. Limits are per application instance.

See [VALIDATION.md](VALIDATION.md) for run results.
