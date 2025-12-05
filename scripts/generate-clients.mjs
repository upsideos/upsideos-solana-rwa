#!/usr/bin/env zx
import 'zx/globals';
import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import { renderVisitor as renderRustVisitor } from '@codama/renderers-rust';

const workingDirectory = path.join(__dirname, '..');

// Program IDL files
const programs = [
  'access_control',
  'dividends', 
  'tokenlock',
  'transfer_restrictions',
];

console.log(chalk.blue('Loading IDL files...\n'));

// Client directories
const jsClient = path.join(workingDirectory, 'clients', 'js');
const rustClient = path.join(workingDirectory, 'clients', 'rust');

// Load prettier config if exists
let prettierConfig = {};
const prettierPath = path.join(jsClient, '.prettierrc.json');
if (fs.existsSync(prettierPath)) {
  prettierConfig = JSON.parse(fs.readFileSync(prettierPath, 'utf-8'));
}

let successCount = 0;
let errorCount = 0;

// Generate each program to its own subdirectory
for (const program of programs) {
  const idlPath = path.join(workingDirectory, 'target', 'idl', `${program}.json`);
  
  if (!fs.existsSync(idlPath)) {
    console.log(chalk.yellow(`⚠ IDL not found for ${program}, skipping...`));
    continue;
  }
  
  try {
    console.log(chalk.blue(`Processing ${program}...`));
    
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    const rootNode = rootNodeFromAnchor(idl);
    const codama = createFromRoot(rootNode);
    
    // Generate JavaScript client for this program
    const jsProgramDir = path.join(jsClient, 'src', 'generated', program);
    fs.mkdirSync(jsProgramDir, { recursive: true });
    await codama.accept(renderJavaScriptVisitor(jsProgramDir, {
      prettier: prettierConfig,
    }));
    
    // Generate Rust client for this program
    const rustProgramDir = path.join(rustClient, 'src', 'generated', program);
    fs.mkdirSync(rustProgramDir, { recursive: true });
    await codama.accept(renderRustVisitor(rustProgramDir, {
      formatCode: true,
      crateFolder: rustClient,
    }));
    
    console.log(chalk.green(`✓ Generated clients for ${program}`));
    successCount++;
  } catch (error) {
    console.log(chalk.red(`✗ Error processing ${program}: ${error.message}`));
    errorCount++;
  }
}

// Generate index files that re-export all programs
if (successCount > 0) {
  // Generate JS index
  const jsIndexContent = programs
    .filter(p => fs.existsSync(path.join(jsClient, 'src', 'generated', p)))
    .map(p => `export * as ${toCamelCase(p)} from './${p}';`)
    .join('\n') + '\n';
  fs.writeFileSync(path.join(jsClient, 'src', 'generated', 'index.ts'), jsIndexContent);
  
  // Generate Rust mod.rs
  const rustModContent = programs
    .filter(p => fs.existsSync(path.join(rustClient, 'src', 'generated', p)))
    .map(p => `pub mod ${p};`)
    .join('\n') + '\n';
  fs.writeFileSync(path.join(rustClient, 'src', 'generated', 'mod.rs'), rustModContent);
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

console.log(chalk.blue('\n─────────────────────────────────'));
if (successCount > 0) {
  console.log(chalk.green(`✓ Generated ${successCount} program client(s)`));
  console.log(chalk.gray(`  JavaScript: ${path.join(jsClient, 'src', 'generated')}`));
  console.log(chalk.gray(`  Rust: ${path.join(rustClient, 'src', 'generated')}`));
}
if (errorCount > 0) {
  console.log(chalk.red(`✗ Failed to generate ${errorCount} program client(s)`));
  process.exit(1);
}
if (successCount === 0 && errorCount === 0) {
  console.log(chalk.red('No IDL files found. Run "anchor build" first.'));
  process.exit(1);
}

console.log(chalk.green('\n✓ Client generation complete!'));

