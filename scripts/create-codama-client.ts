import { AnchorIdl, rootNodeFromAnchorWithoutDefaultVisitor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { visit } from "@codama/visitors-core";
import * as fs from "fs";
import * as path from "path";

const IDL_DIR = path.join(__dirname, "..", "target", "idl");
const OUTPUT_DIR = path.join(__dirname, "..", "clients", "codama");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all IDL files
const idlFiles = fs.readdirSync(IDL_DIR).filter((file) => file.endsWith(".json"));

if (idlFiles.length === 0) {
  console.error(`No IDL files found in ${IDL_DIR}`);
  console.error("Please run 'anchor build' first to generate IDL files.");
  process.exit(1);
}

console.log(`Found ${idlFiles.length} IDL file(s): ${idlFiles.join(", ")}`);

// Process each IDL file
(async () => {
  const errors: Array<{ program: string; error: unknown }> = [];
  let successCount = 0;

  for (const idlFile of idlFiles) {
    const idlPath = path.join(IDL_DIR, idlFile);
    const programName = idlFile.replace(".json", "");
    
    console.log(`\nProcessing ${programName}...`);
    
    try {
      // Load Anchor IDL
      const anchorIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8")) as AnchorIdl;
      
      // Convert Anchor IDL to Codama IDL
      const rootNode = rootNodeFromAnchorWithoutDefaultVisitor(anchorIdl);
      
      // Define output directory for this program
      const programOutputDir = path.join(OUTPUT_DIR, programName, "src");
      
      // Generate the client
      const visitor = renderVisitor(programOutputDir, {});
      await visit(rootNode, visitor);
      
      console.log(`✓ Generated Codama client for ${programName} at ${programOutputDir}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error processing ${programName}:`, error);
      errors.push({ program: programName, error });
    }
  }
  
  console.log(`\n${successCount}/${idlFiles.length} Codama clients generated successfully in ${OUTPUT_DIR}`);
  
  if (errors.length > 0) {
    console.error(`\nFailed to generate ${errors.length} client(s):`);
    errors.forEach(({ program, error }) => {
      console.error(`  - ${program}: ${error instanceof Error ? error.message : String(error)}`);
    });
    process.exit(1);
  }
})();

