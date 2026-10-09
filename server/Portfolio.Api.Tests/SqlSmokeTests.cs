using System.Data;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Portfolio.Api.Tests;

public sealed class SqlFactAttribute : FactAttribute
{
    public SqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PORTFOLIO_TEST_SQL")))
            Skip = "Requires the isolated SQL Server CI job.";
    }
}

public sealed class SqlSmokeTests
{
    [SqlFact]
    public async Task RealSqlPreservesMessagesWhenEmailSucceedsOrFails()
    {
        var connectionString = Environment.GetEnvironmentVariable("PORTFOLIO_TEST_SQL")!;
        var masterSettings = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = "master" };
        await using (var master = new SqlConnection(masterSettings.ConnectionString))
        {
            for (var attempt = 0; ; attempt++)
            {
                try { await master.OpenAsync(); break; }
                catch (SqlException) when (attempt < 59) { await Task.Delay(1000); }
            }
            var schema = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "schema.sql"));
            foreach (var batch in Regex.Split(schema, @"(?im)^\s*GO\s*$"))
            {
                if (string.IsNullOrWhiteSpace(batch)) continue;
                await using var command = new SqlCommand(batch, master);
                await command.ExecuteNonQueryAsync();
            }
        }

        var email = $"sql-{Guid.NewGuid():N}@example.com";
        var requests = new[]
        {
            new ContactRequest
            {
                Name = "SQL Visitor", Email = email, Subject = "Injection smoke",
                Message = "Hello <script>alert('x')</script>;'); DROP TABLE dbo.ContactMessages;--\nUnicode: नमस्ते 👋"
            },
            new ContactRequest
            {
                Name = "SQL Visitor", Email = email, Subject = "Saved despite mail failure",
                Message = new string('x', 5000)
            }
        };
        await using var factory = new PortfolioFactory();
        await using var sqlFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["ConnectionStrings:Portfolio"] = connectionString }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IContactStore>();
                services.AddSingleton<IContactStore, SqlContactStore>();
            });
        });
        using var client = sqlFactory.CreateClient();
        await using var database = new SqlConnection(connectionString);
        await database.OpenAsync();
        try
        {
            for (var index = 0; index < requests.Length; index++)
            {
                factory.Mailer.Fail = index == 1;
                using var response = await client.PostAsJsonAsync("/api/contact", requests[index]);
                Assert.Equal(index == 0 ? HttpStatusCode.OK : HttpStatusCode.Accepted, response.StatusCode);
                var body = await response.Content.ReadFromJsonAsync<ContactResponse>();
                Assert.NotNull(body);
                Assert.True(body.Saved);
                Assert.Equal(index == 0, body.EmailSent);
            }
            await using (var table = new SqlCommand(
                "SELECT COUNT(*) FROM sys.tables WHERE object_id = OBJECT_ID(N'dbo.ContactMessages');", database))
                Assert.Equal(1, (int)(await table.ExecuteScalarAsync())!);
            await using var query = ForVisitor(
                "SELECT Name, Email, Subject, Message FROM dbo.ContactMessages WHERE Email = @email;", database, email);
            await using var reader = await query.ExecuteReaderAsync();
            var expected = requests.ToDictionary(request => request.Subject);
            var seen = new HashSet<string>();
            while (await reader.ReadAsync())
            {
                var subject = reader.GetString(2);
                Assert.True(seen.Add(subject));
                Assert.True(expected.TryGetValue(subject, out var request));
                Assert.Equal(request!.Name, reader.GetString(0));
                Assert.Equal(request.Email, reader.GetString(1));
                Assert.Equal(request.Message, reader.GetString(3));
            }
            Assert.Equal(2, seen.Count);
            Assert.Equal(0, factory.Store.Calls);
            Assert.Equal(2, factory.Mailer.Calls);
        }
        finally
        {
            await using var cleanup = ForVisitor("DELETE FROM dbo.ContactMessages WHERE Email = @email;", database, email);
            await cleanup.ExecuteNonQueryAsync();
        }
    }

    private static SqlCommand ForVisitor(string sql, SqlConnection connection, string email)
    {
        var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = email;
        return command;
    }
}
