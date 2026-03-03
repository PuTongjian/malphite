import { pnpmWorkspaces, Workspace } from "@malphite-tools/utils/workspace";
import { Command } from "./command";

export class InitCommand extends Command {
  static override paths = [["init"], ["i"]];

  async execute() {
    this.generateWorkspaceFiles();
  }

  async generateWorkspaceFiles() {
    this.workspace = new Workspace(pnpmWorkspaces());
  }
}
