#!/usr/bin/env zx
import 'zx/globals';

const clientDir = path.join(__dirname, '..', '..', 'clients', 'rust');

cd(clientDir);

console.log(chalk.blue('Publishing Rust client to crates.io...'));

// Build first
await $`cargo build --release`;

// Publish
await $`cargo publish`;

console.log(chalk.green('✓ Rust client published to crates.io'));

