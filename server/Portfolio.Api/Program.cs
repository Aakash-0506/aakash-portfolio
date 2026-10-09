using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Threading.RateLimiting;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using MimeKit;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 32 * 1024);
builder.Services.AddSingleton<IContactStore, SqlContactStore>();
builder.Services.AddSingleton<IContactMailer, GmailContactMailer>();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("contact", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ContactResponse(false, false,
                "Too many messages. Please wait 10 minutes and try again."), token);
    };
});

var app = builder.Build();
app.UseExceptionHandler(error => error.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(
        new ContactResponse(false, false, "Something went wrong. Please try again later."));
}));
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});
var hasFrontend = File.Exists(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html"));
if (hasFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.UseRouting();
app.UseRateLimiter();
app.MapGet("/api/health", () => Results.Ok(new { status = "running" }));
app.MapPost("/api/contact", ContactEndpoint.HandleAsync).RequireRateLimiting("contact");
app.Map("/api/{**path}", () => Results.NotFound());
if (hasFrontend) app.MapFallbackToFile("index.html");
app.Run();

public sealed class ContactRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public string Website { get; set; } = "";
}

public sealed record ContactResponse(bool Saved, bool EmailSent, string Message);

public interface IContactStore
{
    Task<Guid> SaveAsync(ContactRequest request, CancellationToken cancellationToken);
}

public interface IContactMailer
{
    Task SendAsync(ContactRequest request, Guid messageId, CancellationToken cancellationToken);
}

public static class ContactEndpoint
{
    public static async Task<IResult> HandleAsync(
        ContactRequest input, IContactStore store, IContactMailer mailer,
        ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("ContactEndpoint");
        if (!string.IsNullOrWhiteSpace(input.Website))
            return Results.BadRequest(
                new ContactResponse(false, false, "Unable to submit this message."));

        var request = new ContactRequest
        {
            Name = (input.Name ?? "").Trim(),
            Email = (input.Email ?? "").Trim(),
            Subject = (input.Subject ?? "").Trim(),
            Message = (input.Message ?? "").Trim()
        };
        var errors = Validate(request);
        if (errors.Count > 0)
            return Results.BadRequest(new
            {
                saved = false, emailSent = false,
                message = "Please check your form fields.", errors
            });

        Guid id;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            id = await store.SaveAsync(request, timeout.Token);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Contact message could not be saved.");
            return Results.Json(
                new ContactResponse(false, false,
                    "Your message could not be saved. Please try again later or email aakashgarude@gmail.com."),
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        try
        {
            // Complete the delivery attempt even if the visitor disconnects after saving.
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            await mailer.SendAsync(request, id, timeout.Token);
            return Results.Ok(new ContactResponse(true, true,
                "Your message was saved and accepted by Gmail for delivery."));
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Message {MessageId} was saved, but email delivery failed.", id);
            return Results.Json(
                new ContactResponse(true, false,
                    "Your message was saved, but email could not be sent. Please email aakashgarude@gmail.com directly."),
                statusCode: StatusCodes.Status202Accepted);
        }
    }

    public static Dictionary<string, string[]> Validate(ContactRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Name.Length is < 2 or > 100 || request.Name.Any(char.IsControl))
            errors["name"] = ["Enter a name between 2 and 100 characters."];
        if (request.Email.Length > 254 ||
            !new EmailAddressAttribute().IsValid(request.Email) ||
            request.Email.Any(char.IsControl) ||
            !MailboxAddress.TryParse(request.Email, out var address) ||
            !string.Equals(address.Address, request.Email, StringComparison.OrdinalIgnoreCase))
            errors["email"] = ["Enter a valid email address."];
        if (request.Subject.Length is < 3 or > 150 || request.Subject.Any(char.IsControl))
            errors["subject"] = ["Enter a subject between 3 and 150 characters."];
        if (request.Message.Length is < 10 or > 5000)
            errors["message"] = ["Enter a message between 10 and 5,000 characters."];
        return errors;
    }
}

public sealed class SqlContactStore(IConfiguration configuration) : IContactStore
{
    public async Task<Guid> SaveAsync(ContactRequest request, CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("Portfolio");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("The Portfolio database is not configured.");

        var id = Guid.NewGuid();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        using var command = new SqlCommand("""
            INSERT INTO dbo.ContactMessages (Id, Name, Email, Subject, Message)
            VALUES (@id, @name, @email, @subject, @message);
            """, connection) { CommandTimeout = 10 };
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = id;
        command.Parameters.Add("@name", SqlDbType.NVarChar, 100).Value = request.Name;
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = request.Email;
        command.Parameters.Add("@subject", SqlDbType.NVarChar, 150).Value = request.Subject;
        command.Parameters.Add("@message", SqlDbType.NVarChar, -1).Value = request.Message;
        await command.ExecuteNonQueryAsync(cancellationToken);
        return id;
    }
}

public sealed class GmailContactMailer(IConfiguration configuration) : IContactMailer
{
    public async Task SendAsync(ContactRequest request, Guid messageId, CancellationToken cancellationToken)
    {
        var sender = configuration["Gmail:Sender"];
        var password = configuration["Gmail:AppPassword"];
        if (string.IsNullOrWhiteSpace(sender) || string.IsNullOrWhiteSpace(password) ||
            !MailboxAddress.TryParse(sender, out var senderAddress) ||
            !string.Equals(senderAddress.Address, sender, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Gmail sender and app password must be configured.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("Aakash's portfolio", sender));
        message.To.Add(new MailboxAddress("Aakash Garude", "aakashgarude@gmail.com"));
        message.ReplyTo.Add(new MailboxAddress(request.Name, request.Email));
        message.Subject = $"Portfolio: {request.Subject}";
        message.Body = new TextPart("plain")
        {
            Text = $"From: {request.Name}\nEmail: {request.Email}\n" +
                $"Reference: {messageId}\n\n{request.Message}"
        };
        using var client = new SmtpClient { Timeout = 15000 };
        await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(sender, password.Replace(" ", ""), cancellationToken);
        await client.SendAsync(message, cancellationToken);
        // SMTP acceptance does not guarantee inbox placement; disposing closes the connection.
    }
}

public partial class Program { }
