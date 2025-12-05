#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'js');

cd(clientDir);

console.log(chalk.blue('Testing JavaScript client...'));

await $`pnpm test`;

console.log(chalk.green('✓ JavaScript client tests passed'));

