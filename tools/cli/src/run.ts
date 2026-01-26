import { Command } from "./command";

export class RunCommand extends Command {
  static override paths = [["run"], ["r"], Command.Default];

  async execute() {
    this.context.stdout.write(`Hello RunCommand!\n`);
  }
}
