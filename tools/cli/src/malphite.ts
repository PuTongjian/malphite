import { Cli } from "clipanion";

const cli = new Cli({
  binaryName: "malphite",
  binaryVersion: "0.0.1",
  binaryLabel: "Malphite CLI",
  enableColors: true,
  enableCapture: true,
});

await cli.runExit(process.argv.slice(2));
