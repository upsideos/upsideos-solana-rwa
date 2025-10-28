const fs = require('fs');

const files = [
  'app/src/types/access_control.ts',
  'app/src/types/dividends.ts',
  'app/src/types/tokenlock.ts',
  'app/src/types/transfer_restrictions.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Step 1: Remove quotes from property names
  // Pattern: "propertyName": becomes propertyName:
  content = content.replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g, '$1:');
  
  // Step 2: Replace commas with semicolons for property separators ONLY
  // Keep commas for array element separators
  
  // The key is to identify when a comma separates properties (use ;) vs array elements (keep ,)
  // A property separator is when comma is followed by a property name (identifier followed by :)
  
  // Replace trailing commas after any value when followed by a property name
  // Property name pattern: optional whitespace, newline, whitespace, lowercase letter/underscore, 
  // then eventually a colon (but we don't need to match the colon in the replacement)
  
  // After any value (string, number, boolean, closing bracket/brace) followed by property name
  content = content.replace(/,(\s*\n\s+)([a-z_][a-zA-Z0-9_]*\s*:)/g, ';$1$2');
  
  fs.writeFileSync(file, content);
  console.log(`Formatted: ${file}`);
});

console.log('Done!');
