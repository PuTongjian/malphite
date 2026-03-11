// import type { Path } from "@malphite-tools/utils/path";
import { pnpmWorkspaces, Workspace } from "@malphite-tools/utils/workspace";
// import { applyEdits, modify } from "jsonc-parser";
import { Command } from "./command";

export class InitCommand extends Command {
  static override paths = [["init"], ["i"]];

  async execute() {
    this.generateWorkspaceFiles();
  }

  async generateWorkspaceFiles() {
    this.workspace = new Workspace(pnpmWorkspaces());

    // const filesToGenerate: [Path, (prev: string) => string][] = [
    //   [this.workspace.join("tsconfig.json")],
    // ];
  }

  // genProjectTsConfig = (prev: string) => {
  //   return applyEdits(
  //     prev,
  //     modify(
  //       prev,
  //       ['references'],
  //       this.workspace.
  //     )
  //   )
  // };
}
