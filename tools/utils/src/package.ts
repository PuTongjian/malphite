import { readFileSync } from "node:fs";
import { type Path, ProjectRoot } from "./path";
import { PackageList } from "./pnpm";
import type { CommonPackageJsonContent, PnpmWorkspaceItem } from "./types";
import type { Workspace } from "./workspace";
import type { PackageName } from "./workspace.gen";

function readPackageJson(path: Path): CommonPackageJsonContent {
  const content = readFileSync(path.join("package.json").toString(), "utf-8");

  return JSON.parse(content);
}

export class Package {
  readonly name: PackageName;
  readonly path: Path;
  readonly packageJson: CommonPackageJsonContent;
  readonly isTsProject: boolean = false;
  readonly workspaceDependencies: string[];
  deps: Package[] = [];
  private _workspace: Workspace | null = null;

  constructor(name: PackageName, meta?: PnpmWorkspaceItem) {
    this.name = name;
    meta ??= PackageList.find((item) => item.name === name)!;

    this.path = ProjectRoot.join(meta.path);

    // parse workspace
    this.packageJson = readPackageJson(this.path);
    this.isTsProject = this.path.join("tsconfig.json").isFile();
    this.workspaceDependencies = meta.workspaceDependencies;
  }

  get workspace() {
    if (!this._workspace) {
      throw new Error("Workspace is not initialized");
    }

    return this._workspace;
  }

  set workspace(workspace: Workspace) {
    this._workspace = workspace;
  }

  join(...paths: string[]) {
    return this.path.join(...paths);
  }
}
