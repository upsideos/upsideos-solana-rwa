const fs = require("fs");

// UncheckedAccount makes Anchor emit signer: false. Single-key clients still
// need the authority meta marked as a signer; multisig callers clear that flag
// and append member accounts.
const INSTRUCTIONS = {
  access_control: [
    "mint_securities",
    "burn_securities",
    "force_transfer_between",
    "freeze_wallet",
    "thaw_wallet",
    "grant_role",
  ],
  transfer_restrictions: [
    "initialize_transfer_restrictions_data",
    "initialize_transfer_restriction_group",
    "initialize_transfer_restriction_holder",
    "initialize_holder_group",
    "initialize_transfer_rule",
    "initialize_security_associated_account",
    "initialize_default_security_accounts",
    "revoke_holder",
    "revoke_holder_group",
    "revoke_security_associated_account",
    "set_address_permission",
    "set_lockup_escrow_account",
  ],
};

function camelCase(name) {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function patchIdl(idl, names) {
  let changed = false;
  for (const name of names) {
    const instruction = idl.instructions.find((ix) => ix.name === name);
    if (!instruction) {
      throw new Error(`IDL is missing instruction ${name}`);
    }
    const authority = instruction.accounts.find(
      (account) => account.name === "authority"
    );
    if (!authority) {
      throw new Error(`${name} is missing an authority account`);
    }
    if (authority.signer !== true) {
      authority.signer = true;
      changed = true;
    }
  }
  return changed;
}

function patchJsonFile(file, names) {
  if (!fs.existsSync(file)) {
    return;
  }
  const original = fs.readFileSync(file, "utf8");
  const idl = JSON.parse(original);
  if (!patchIdl(idl, names)) {
    console.log(`Authority signer already set: ${file}`);
    return;
  }
  fs.writeFileSync(file, JSON.stringify(idl, null, 2) + "\n");
  console.log(`Restored authority signer: ${file}`);
}

function patchTypeSource(source, names) {
  let updated = source;
  for (const name of names) {
    const markers = [
      `name: "${camelCase(name)}"`,
      `name: "${name}"`,
      `"name": "${name}"`,
      `"name": "${camelCase(name)}"`,
    ];
    const start = markers
      .map((marker) => updated.indexOf(marker))
      .find((index) => index >= 0);
    if (start === undefined) {
      throw new Error(`type file is missing instruction ${name}`);
    }
    const nextInstruction = updated.indexOf("\n    {", start + 1);
    const end = nextInstruction === -1 ? updated.length : nextInstruction;
    const block = updated.slice(start, end);
    const patched = patchAuthorityBlock(block, name);
    updated = updated.slice(0, start) + patched + updated.slice(end);
  }
  return updated;
}

function patchAuthorityBlock(block, name) {
  const accountPattern =
    /\{[^{}]*?(?:name:\s*"authority"|"name":\s*"authority")[^{}]*?\}/;
  const match = block.match(accountPattern);
  if (!match) {
    throw new Error(`${name} type block has no authority account`);
  }
  const account = match[0];
  if (/"signer":\s*true\b/.test(account) || /signer:\s*true\b/.test(account)) {
    return block;
  }
  let replacement;
  if (/"signer":\s*false\b/.test(account)) {
    replacement = account.replace(/"signer":\s*false\b/, '"signer": true');
  } else if (/signer:\s*false\b/.test(account)) {
    replacement = account.replace(/signer:\s*false\b/, "signer: true");
  } else if (account.includes('"name"')) {
    replacement = account.replace(
      /"name":\s*"authority"/,
      '"name": "authority",\n          "signer": true'
    );
  } else {
    replacement = account.replace(
      /name:\s*"authority";?/,
      'name: "authority";\n          signer: true'
    );
  }
  return block.replace(account, replacement);
}

function patchTypeFile(file, names) {
  if (!fs.existsSync(file)) {
    return;
  }
  const original = fs.readFileSync(file, "utf8");
  const updated = patchTypeSource(original, names);
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    console.log(`Restored authority signer: ${file}`);
  } else {
    console.log(`Authority signer already set: ${file}`);
  }
}

for (const [program, names] of Object.entries(INSTRUCTIONS)) {
  patchJsonFile(`target/idl/${program}.json`, names);
  patchJsonFile(`app/src/idls/${program}.json`, names);
  patchTypeFile(`target/types/${program}.ts`, names);
  patchTypeFile(`app/src/types/${program}.ts`, names);
}
