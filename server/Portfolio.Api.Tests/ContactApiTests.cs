using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Portfolio.Api.Tests;

public sealed class ContactApiTests
{
    private static ContactRequest Valid() => new()
    {
        Name = "Visitor Example",
        Email = "visitor@example.com",
        Subject = "Portfolio opportunity",
        Message = "Hello Aakash, I would like to discuss an opportunity."
    };

    private static async Task<JsonElement> Body(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    [Theory]
    [InlineData("name")]
    [InlineData("email")]
    [InlineData("subject")]
    [InlineData("message")]
    public async Task InvalidFieldsAreRejectedBeforeStorage(string field)
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        var request = Valid();
        switch (field)
        {
            case "name": request.Name = "x"; break;
            case "email": request.Email = "invalid"; break;
            case "subject": request.Subject = "x"; break;
            case "message": request.Message = "short"; break;
        }
        using var response = await client.PostAsJsonAsync("/api/contact", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Body(response)).GetProperty("errors").TryGetProperty(field, out _));
        Assert.Equal(0, factory.Store.Calls);
        Assert.Equal(0, factory.Mailer.Calls);
    }

    [Fact]
    public async Task OversizedMessageIsRejectedBeforeStorage()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        var request = Valid();
        request.Message = new string('a', 5001);
        using var response = await client.PostAsJsonAsync("/api/contact", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.Store.Calls);
    }

    [Fact]
    public async Task HoneypotIsRejectedBeforeStorage()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        var request = Valid();
        request.Website = "https://spam.example";
        using var response = await client.PostAsJsonAsync("/api/contact", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await Body(response)).GetProperty("saved").GetBoolean());
        Assert.Equal(0, factory.Store.Calls);
        Assert.Equal(0, factory.Mailer.Calls);
    }

    [Fact]
    public async Task StorageFailureDoesNotSendEmailOrReportSuccess()
    {
        await using var factory = new PortfolioFactory();
        factory.Store.Fail = true;
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/contact", Valid());
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await Body(response);
        Assert.False(body.GetProperty("saved").GetBoolean());
        Assert.False(body.GetProperty("emailSent").GetBoolean());
        Assert.Equal(1, factory.Store.Calls);
        Assert.Equal(0, factory.Mailer.Calls);
    }

    [Fact]
    public async Task MailFailureHonestlyReportsSavedButNotSent()
    {
        await using var factory = new PortfolioFactory();
        factory.Mailer.Fail = true;
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/contact", Valid());
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var body = await Body(response);
        Assert.True(body.GetProperty("saved").GetBoolean());
        Assert.False(body.GetProperty("emailSent").GetBoolean());
        Assert.Equal(1, factory.Store.Calls);
        Assert.Equal(1, factory.Mailer.Calls);
        Assert.True(factory.Mailer.StorageCompletedBeforeSend);
    }

    [Fact]
    public async Task ValidMessageIsTrimmedSavedThenSent()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        var request = Valid();
        request.Name = "  Visitor Example  ";
        request.Email = "  visitor@example.com  ";
        using var response = await client.PostAsJsonAsync("/api/contact", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Body(response);
        Assert.True(body.GetProperty("saved").GetBoolean());
        Assert.True(body.GetProperty("emailSent").GetBoolean());
        Assert.NotNull(factory.Store.SavedRequest);
        Assert.Equal("Visitor Example", factory.Store.SavedRequest.Name);
        Assert.Equal("visitor@example.com", factory.Store.SavedRequest.Email);
        Assert.Same(factory.Store.SavedRequest, factory.Mailer.SentRequest);
        Assert.Equal(factory.Store.Id, factory.Mailer.MessageId);
        Assert.True(factory.Mailer.StorageCompletedBeforeSend);
    }

    [Fact]
    public async Task SixthRequestIsRateLimitedWithoutAnotherSaveOrEmail()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        for (var index = 0; index < 5; index++)
        {
            using var accepted = await client.PostAsJsonAsync("/api/contact", Valid());
            Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        }
        using var response = await client.PostAsJsonAsync("/api/contact", Valid());
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.False((await Body(response)).GetProperty("emailSent").GetBoolean());
        Assert.Equal(5, factory.Store.Calls);
        Assert.Equal(5, factory.Mailer.Calls);
    }

    [Fact]
    public async Task HealthRouteRunsWithoutContactDependencies()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("running", (await Body(response)).GetProperty("status").GetString());
        Assert.Equal(0, factory.Store.Calls);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/client-side-route")]
    public async Task StaticFrontendAndSpaFallbackServeTheFrontend(string path)
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("PORTFOLIO_TEST_PAGE", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UnknownApiRouteDoesNotReturnTheSpa()
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

internal sealed class PortfolioFactory : WebApplicationFactory<global::Program>
{
    private readonly string root = Path.Combine(Path.GetTempPath(), $"aakash-portfolio-tests-{Guid.NewGuid():N}");
    public FakeStore Store { get; } = new();
    public FakeMailer Mailer { get; }

    public PortfolioFactory()
    {
        Mailer = new FakeMailer(Store);
        Directory.CreateDirectory(Path.Combine(root, "wwwroot"));
        File.WriteAllText(Path.Combine(root, "wwwroot", "index.html"),
            "<!doctype html><html><body>PORTFOLIO_TEST_PAGE</body></html>");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseContentRoot(root);
        builder.UseWebRoot(Path.Combine(root, "wwwroot"));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IContactStore>();
            services.RemoveAll<IContactMailer>();
            services.AddSingleton<IContactStore>(Store);
            services.AddSingleton<IContactMailer>(Mailer);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
    }
}

internal sealed class FakeStore : IContactStore
{
    private int calls;
    public bool Fail { get; set; }
    public int Calls => Volatile.Read(ref calls);
    public Guid Id { get; } = Guid.NewGuid();
    public ContactRequest? SavedRequest { get; private set; }
    public Func<CancellationToken, Task>? BeforeSave { get; set; }

    public async Task<Guid> SaveAsync(ContactRequest request, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        if (Fail) throw new InvalidOperationException("Storage unavailable in test.");
        if (BeforeSave is { } beforeSave) await beforeSave(cancellationToken);
        SavedRequest = request;
        return Id;
    }
}

internal sealed class FakeMailer(FakeStore store) : IContactMailer
{
    public bool Fail { get; set; }
    private int calls;
    public int Calls => Volatile.Read(ref calls);
    public bool StorageCompletedBeforeSend { get; private set; }
    public Guid MessageId { get; private set; }
    public ContactRequest? SentRequest { get; private set; }

    public Task SendAsync(ContactRequest request, Guid messageId, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        StorageCompletedBeforeSend = store.SavedRequest is not null;
        MessageId = messageId;
        SentRequest = request;
        if (Fail) throw new InvalidOperationException("SMTP unavailable in test.");
        return Task.CompletedTask;
    }
}
