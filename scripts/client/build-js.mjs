#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'js');

cd(clientDir);

console.log(chalk.blue('Building JavaScript client...'));

await $`pnpm install`;
await $`pnpm build`;

console.log(chalk.green('✓ JavaScript client built successfully'));

