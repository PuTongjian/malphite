import { Cli } from "clipanion";
import type { CliContext } from "./context";
import { RunCommand } from "./run";

const cli = new Cli<CliContext>({
  binaryName: "malphite",
  binaryVersion: "0.0.1",
  binaryLabel: "Malphite CLI",
  enableColors: true,
  enableCapture: true,
});

cli.register(RunCommand);

await cli.runExit(process.argv.slice(2), {
  workspace: "xxxx",
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
