import { Cli, Command, Option } from "clipanion";

export class MalphiteCommand extends Command {
  name = Option.String();

  async execute() {
    this.context.stdout.write(`hello ${this.name}\n`);
  }
}

const [node, file, ...options] = process.argv;
console.log({ node, file, options });

const cli = new Cli({
  binaryLabel: `Malphite CLI`,
  binaryName: `${node} ${file}`,
  binaryVersion: `1.0.0`,
});

cli.register(MalphiteCommand);
cli.runExit(options);
