#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'rust');

cd(clientDir);

console.log(chalk.blue('Building Rust client...'));

await $`cargo build`;

console.log(chalk.green('✓ Rust client built successfully'));

