IF DB_ID(N'PortfolioDb') IS NULL
    CREATE DATABASE PortfolioDb;
GO
USE PortfolioDb;
GO
IF OBJECT_ID(N'dbo.ContactMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ContactMessages
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ContactMessages PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Email NVARCHAR(254) NOT NULL,
        Subject NVARCHAR(150) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL CONSTRAINT CK_ContactMessages_MessageLength CHECK (LEN(Message) BETWEEN 10 AND 5000),
        CreatedAtUtc DATETIME2(0) NOT NULL CONSTRAINT DF_ContactMessages_CreatedAtUtc DEFAULT SYSUTCDATETIME()
    );
END;
GO
