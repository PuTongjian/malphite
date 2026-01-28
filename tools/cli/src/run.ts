import { Option } from "clipanion";
import { Command } from "./command";

export class RunCommand extends Command {
  static override paths = [["run"], ["r"], Command.Default];

  static override usage = Command.Usage({
    description: "`Malphite Monorepo scripts`",
    details: `
      \`affine dev\`             A proxy for package's \`dev\` script
    `,
  });

  args = Option.Proxy({ name: "args", required: 1 });

  async execute() {
    console.log(this.args);
    this.context.stdout.write(`Hello RunCommand!\n ${this.cmd}\n`);
  }
}
