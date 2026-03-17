import { type Path, ProjectRoot } from "./path";
import { PackageList } from "./pnpm";
import type { PnpmWorkspaceItem } from "./types";
import type { Workspace } from "./workspace";
import type { PackageName } from "./workspace.gen";

export class Package {
  readonly name: PackageName;
  readonly path: Path;
  private _workspace: Workspace | null = null;

  constructor(name: PackageName, meta?: PnpmWorkspaceItem) {
    this.name = name;
    meta ??= PackageList.find((item) => item.name === name)!;

    this.path = ProjectRoot.join(meta.path);
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
