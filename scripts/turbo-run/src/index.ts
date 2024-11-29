import { cac } from "cac";
import { run } from "./run";

try {
  const cli = cac("turbo-run");

  cli
    .command("[script]")
    .usage("Run turbo interactively.")
    .action(async (command: string) => {
      run({ command });
    });

  cli.usage("turbo-run");
  cli.help();
  cli.parse();

} catch (error) {
  console.error(error);
}
