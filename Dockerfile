FROM node:24-alpine AS frontend
WORKDIR /src/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY server/Portfolio.Api/Portfolio.Api.csproj server/Portfolio.Api/
RUN dotnet restore server/Portfolio.Api/Portfolio.Api.csproj
COPY server/Portfolio.Api/ server/Portfolio.Api/
COPY --from=frontend /src/server/Portfolio.Api/wwwroot/ server/Portfolio.Api/wwwroot/
RUN dotnet publish server/Portfolio.Api/Portfolio.Api.csproj --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish ./
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Portfolio.Api.dll"]
