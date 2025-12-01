#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'js');

cd(clientDir);

console.log(chalk.blue('Publishing JavaScript client to npm...'));

// Ensure we're logged in
try {
  await $`npm whoami`;
} catch {
  console.log(chalk.red('Not logged in to npm. Run "npm login" first.'));
  process.exit(1);
}

// Build first
await $`pnpm build`;

// Publish
await $`npm publish --access public`;

console.log(chalk.green('✓ JavaScript client published to npm'));

