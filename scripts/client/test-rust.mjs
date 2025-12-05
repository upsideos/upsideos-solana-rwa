#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'rust');

cd(clientDir);

console.log(chalk.blue('Testing Rust client...'));

await $`cargo test`;

console.log(chalk.green('✓ Rust client tests passed'));

