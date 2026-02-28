import { Workspace } from "@malphite-tools/utils/workspace";
import { Cli } from "clipanion";
import type { CliContext } from "./context";
import { DevCommand } from "./dev";
import { InitCommand } from "./init";
import { RunCommand } from "./run";

const cli = new Cli<CliContext>({
  binaryName: "malphite",
  binaryVersion: "0.0.1",
  binaryLabel: "Malphite CLI",
  enableColors: true,
  enableCapture: true,
});

cli.register(RunCommand);
cli.register(DevCommand);
cli.register(InitCommand);

await cli.runExit(process.argv.slice(2), {
  workspace: new Workspace(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
