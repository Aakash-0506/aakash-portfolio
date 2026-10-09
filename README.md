# Aakash Garude — Developer Portfolio

A first personal portfolio built with React and ASP.NET Core. It introduces Aakash, presents his technology stack and portfolio project, and provides a contact form addressed to **aakashgarude@gmail.com**.

The design uses a warm light theme, a dark theme, responsive layouts and accessible form feedback. It does not claim employment history or list invented projects.

## Stack

| Layer | Technology |
| --- | --- |
| Interface | React, HTML, CSS, JavaScript, Vite |
| API | C#, ASP.NET Core on .NET 10 |
| Storage | Microsoft SQL Server |
| Email | Gmail SMTP with STARTTLS, using MailKit |
| Checks | Node test runner, xUnit, GitHub Actions |

## How contact messages work

1. React validates the visitor's form.
2. `POST /api/contact` validates again, checks the hidden spam field and limits each IP address to five attempts per ten minutes.
3. The API saves the message in SQL Server using parameterized queries.
4. It sends a plain-text email to `aakashgarude@gmail.com`. Replying to the email addresses the visitor through the Reply-To header.

| Status | Meaning shown to the visitor |
| --- | --- |
| 200 | Message saved and SMTP accepted the email. |
| 202 | Message saved, but email delivery failed; the visitor is advised to email directly. |
| 400 | Invalid submission or spam field filled. |
| 429 | Too many attempts. |
| 503 | Message could not be saved. |

A 202 response does not schedule a retry. Failed email attempts are logged with the stored message ID. SMTP acceptance cannot guarantee inbox placement.

## Run on Windows

Install Node.js 24 LTS, the .NET 10 SDK, and Microsoft SQL Server or SQL Server Express LocalDB. Use SSMS or `sqlcmd` to run `database/schema.sql` once.

From the repository root, a LocalDB example is:

```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -E -C -i database/schema.sql
```

If LocalDB is installed but stopped, run `sqllocaldb start MSSQLLocalDB`. For a different SQL Server instance, run the same script in SSMS against that instance and adjust the connection string below.

Configure the backend using .NET user secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:Portfolio" "Server=(localdb)\MSSQLLocalDB;Database=PortfolioDb;Integrated Security=true;Encrypt=true;TrustServerCertificate=true" --project server/Portfolio.Api
dotnet user-secrets set "Gmail:Sender" "aakashgarude@gmail.com" --project server/Portfolio.Api
dotnet user-secrets set "Gmail:AppPassword" "YOUR_GOOGLE_APP_PASSWORD" --project server/Portfolio.Api
```

The local connection string trusts the local SQL certificate. Use a trusted database certificate and `TrustServerCertificate=false` in production.

Start the API in one terminal:

```powershell
dotnet run --project server/Portfolio.Api --urls http://127.0.0.1:5080
```

Start React in a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite forwards `/api` requests to the backend on port 5080.

The interface works without SQL or Gmail credentials; submitting the contact form requires them. `npm run preview` previews static frontend files only and does not provide a contact API.

## Gmail configuration

Enable 2-Step Verification and create an app password for an eligible Google account. Google's instructions are available at [Sign in with app passwords](https://support.google.com/accounts/answer/185833).

Enter that app password in the user-secrets command on your own computer. Never put it in React code, a VITE variable, a committed configuration file, a GitHub issue, or a chat message. The source contains empty credential placeholders only.

The backend connects to `smtp.gmail.com:587` using STARTTLS. The sender is the authenticated account; the recipient is fixed to `aakashgarude@gmail.com`.

## Build and test

From the root:

```powershell
node scripts/build.mjs
```

This installs frontend packages, runs contact-form unit tests, builds React into `server/Portfolio.Api/wwwroot`, runs backend integration tests with fake storage/email services, and publishes the combined app to `artifacts`.

Start the published app from its output directory:

```powershell
cd artifacts
dotnet Portfolio.Api.dll --urls http://127.0.0.1:5080
```

User secrets are for development. When running the published app in Production, supply the environment variables described below.

Run checks separately:

```powershell
cd client
npm test
npm run build
cd ..
dotnet test server/Portfolio.Api.Tests/Portfolio.Api.Tests.csproj --configuration Release
```

GitHub Actions runs the same build and uploads the published app as an artifact. The tests cover validation, spam rejection, store-before-email ordering, storage failures, email failures, rate limits and static routing. Fakes ensure the tests send no real emails and need no live database.

The first `npm install` generates `client/package-lock.json`. Commit it after reviewing the resolved versions.

## Deploy

Use an ASP.NET Core host such as IIS, Azure App Service, or a container host. This application requires a running .NET backend and SQL Server; GitHub Pages cannot run its contact API.

The included Dockerfile builds the frontend and backend together:

```text
docker build -t aakash-portfolio .
```

Supply these variables privately in the host's secret settings:

| Variable | Value |
| --- | --- |
| `ConnectionStrings__Portfolio` | Production SQL Server connection string |
| `Gmail__Sender` | Gmail account used to authenticate |
| `Gmail__AppPassword` | Google app password for that account |

Use HTTPS, restrict the database account to the permissions it needs, and configure `AllowedHosts` for your hostname. If you deploy behind a reverse proxy, configure ASP.NET Core forwarded headers with explicitly trusted proxies before IP-based rate limiting. The current API uses its direct connection IP.

Before sharing the site, send a real message, confirm the SQL row, and check the receiving Gmail account including Spam. The `/api/health` endpoint reports process liveness; it does not verify SQL or email.

## Personalize

- Text, navigation, skills and GitHub links: `client/src/App.jsx`
- Theme and responsive styling: `client/src/styles.css`
- Contact input validation and delivery feedback: `client/src/contact.js`
- API, SQL storage and Gmail sender: `server/Portfolio.Api/Program.cs`
- Database schema: `database/schema.sql`

No CV download is included because the supplied PDF was not readable in the authoring session. Education and certifications can be added when confirmed.
