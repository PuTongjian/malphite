import { Command } from "./command";

export class DevCommand extends Command {
  static override paths = [["dev"], ["d"]];

  async execute() {
    // console.log(this.args);
    this.context.stdout.write(`Hello DevCommand!\n ${this.cmd}\n`);
  }
}
