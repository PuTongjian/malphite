import { Command } from "./command";

export class InitCommand extends Command {
  static override paths = [["init"], ["i"]];

  async execute() {
    this.generateWorkspaceFiles();
  }

  async generateWorkspaceFiles() {}
}
