import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { existsSync } from "node:fs";

const scriptsFolder = join(fileURLToPath(import.meta.url), "..", "..");
const scriptSrcFolder = join(scriptsFolder, "src");
const projectRoot = join(scriptsFolder, "..", "..");

const [node, _self, file] = process.argv;

if (!file) {
  console.error(`Please provide a file to run, e.g. 'run src/index.{js/ts}'`);
  process.exit(1);
}

const fileLocationCandidates = new Set([
  process.cwd(),
  scriptSrcFolder,
  projectRoot,
]);
const lookups = [];

/**
 * @type {string | undefined}
 */
let scriptLocation;

for (const location of fileLocationCandidates) {
  if (scriptLocation) {
    break;
  }

  const fileCandidates = [file, `${file}.js`, `${file}.ts`];
  for (const candidates of fileCandidates) {
    const candidateLocation = join(location, candidates);
    if (existsSync(candidateLocation)) {
      scriptLocation = candidateLocation;
      break;
    }
    lookups.push(candidateLocation);
  }
}

if (!scriptLocation) {
  console.error(
    `File ${file} not found, please make sure the first parameter passed to 'run' script is a valid js or ts file.`,
  );
  console.error(`Searched locations: `);
  lookups.forEach((location) => {
    console.error(`  - ${location}`);
  });
  process.exit(1);
}

// const nodeOptions = []

// if (scriptLocation.endsWith('.ts') || scriptLocation)
const spawn = require("child_process").spawn;
