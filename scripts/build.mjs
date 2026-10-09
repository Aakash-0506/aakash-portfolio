import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd, stdio: 'inherit', shell: process.platform === 'win32' && command === npm,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npm, ['install', '--no-audit', '--no-fund'], path.join(root, 'client'));
run(npm, ['test'], path.join(root, 'client'));
run(npm, ['run', 'build'], path.join(root, 'client'));
run('dotnet', ['test', 'server/Portfolio.Api.Tests/Portfolio.Api.Tests.csproj', '--configuration', 'Release']);
run('dotnet', ['publish', 'server/Portfolio.Api/Portfolio.Api.csproj', '--configuration', 'Release', '--output', 'artifacts']);
console.log('Built successfully. Run: cd artifacts && dotnet Portfolio.Api.dll');
