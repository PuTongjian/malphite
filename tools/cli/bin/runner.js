import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsFolder = join(fileURLToPath(import.meta.url), "..", "..");
const scriptSrcFolder = join(scriptsFolder, "src");
const projectRoot = join(scriptsFolder, "..", "..");

const [node, _self, file, ...options] = process.argv;

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

const nodeOptions = [];

// 当 MALPHITE_DEBUG=1 时，将 --inspect-brk 传给子进程，便于 VS Code 调试
if (process.env.MALPHITE_DEBUG === "1") {
  nodeOptions.unshift("--inspect-brk");
}

if (
  scriptLocation.endsWith(".ts") ||
  scriptLocation.startsWith(scriptsFolder)
) {
  nodeOptions.unshift("--import=tsx/esm");
} else {
  nodeOptions.unshift("--experimental-specifier-resolution=node");
}

spawn(node, [...nodeOptions, scriptLocation, ...options], {
  stdio: "inherit",
}).on("exit", (code) => {
  process.exit(code ?? 0);
});
