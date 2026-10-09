using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Portfolio.Api.Tests;

public sealed class SecurityApiTests
{
    private static ContactRequest Valid() => new()
    {
        Name = "Visitor Example", Email = "visitor@example.com",
        Subject = "Portfolio opportunity",
        Message = "Hello Aakash, I would like to discuss an opportunity."
    };

    [Theory]
    [InlineData("Development", "{", "application/json", 400)]
    [InlineData("Production", "{", "application/json", 400)]
    [InlineData("Development", "null", "application/json", 400)]
    [InlineData("Production", "null", "application/json", 400)]
    [InlineData("Development", "", "application/json", 400)]
    [InlineData("Production", "", "application/json", 400)]
    [InlineData("Development", "hello", "text/plain", 415)]
    [InlineData("Production", "hello", "text/plain", 415)]
    public async Task BindingErrorsKeepTheirClientErrorStatus(string environment, string payload, string contentType, int expectedStatus)
    {
        await using var owner = new PortfolioFactory();
        await using var factory = owner.WithWebHostBuilder(builder => builder.UseEnvironment(environment));
        using var client = factory.CreateClient();
        using var content = new StringContent(payload, Encoding.UTF8, contentType);
        using var response = await client.PostAsync("/api/contact", content);
        Assert.Equal(expectedStatus, (int)response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("System.Text.Json", text);
        Assert.DoesNotContain("StackTrace", text);
        Assert.Equal(0, owner.Store.Calls);
        Assert.Equal(0, owner.Mailer.Calls);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/api/health")]
    public async Task FrontendAndApiReturnSecurityHeaders(string path)
    {
        await using var factory = new PortfolioFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        var csp = string.Join(" ", response.Headers.GetValues("Content-Security-Policy"));
        Assert.Contains("frame-ancestors 'none'", csp);
        Assert.Contains("object-src 'none'", csp);
        Assert.DoesNotContain("unsafe-inline", csp);
    }

    [Fact]
    public async Task MissingSqlConfigurationReturns503WithoutInternalDetails()
    {
        await using var owner = new PortfolioFactory();
        await using var factory = owner.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["ConnectionStrings:Portfolio"] = "" }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IContactStore>();
                services.AddSingleton<IContactStore, SqlContactStore>();
            });
        });
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/contact", Valid());
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(text);
        Assert.False(document.RootElement.GetProperty("saved").GetBoolean());
        Assert.False(document.RootElement.GetProperty("emailSent").GetBoolean());
        Assert.DoesNotContain("InvalidOperationException", text);
        Assert.DoesNotContain("ConnectionStrings", text);
        Assert.DoesNotContain("StackTrace", text);
        Assert.Equal(0, owner.Mailer.Calls);
    }

    [Fact]
    public async Task RotatingAddressesCannotBypassTheOverallContactBudget()
    {
        await using var factory = new PortfolioFactory();
        for (var index = 1; index <= 30; index++)
            Assert.Equal(StatusCodes.Status200OK, (await SubmitFromIp(factory, $"192.0.2.{index}")).Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, (await SubmitFromIp(factory, "192.0.2.31")).Response.StatusCode);
        Assert.Equal(30, factory.Store.Calls);
        Assert.Equal(30, factory.Mailer.Calls);
    }

    [Fact]
    public async Task FifthConcurrentSubmissionIsRejectedBeforeStorage()
    {
        await using var factory = new PortfolioFactory();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var arrivals = 0;
        factory.Store.BeforeSave = async token =>
        {
            if (Interlocked.Increment(ref arrivals) == 4) entered.TrySetResult();
            await release.Task.WaitAsync(token);
        };
        var inFlight = Enumerable.Range(1, 4).Select(index => SubmitFromIp(factory, $"192.0.2.{index}")).ToArray();
        try
        {
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal(StatusCodes.Status429TooManyRequests, (await SubmitFromIp(factory, "192.0.2.5")).Response.StatusCode);
            Assert.Equal(4, factory.Store.Calls);
            Assert.Equal(0, factory.Mailer.Calls);
        }
        finally
        {
            release.TrySetResult();
            await Task.WhenAll(inFlight).WaitAsync(TimeSpan.FromSeconds(10));
        }
        foreach (var task in inFlight)
            Assert.Equal(StatusCodes.Status200OK, (await task).Response.StatusCode);
    }

    private static async Task<HttpContext> SubmitFromIp(PortfolioFactory factory, string address)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(Valid(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var body = new MemoryStream(json);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        return await factory.Server.SendAsync(context =>
        {
            context.Connection.RemoteIpAddress = IPAddress.Parse(address);
            context.Request.Method = HttpMethods.Post;
            context.Request.Path = "/api/contact";
            context.Request.ContentType = "application/json";
            context.Request.ContentLength = json.Length;
            context.Request.Body = body;
        }, timeout.Token);
    }
}
