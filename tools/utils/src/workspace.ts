import { ProjectRoot } from "./path";
import { PackageList, pnpmWorkspaces } from "./pnpm";

export class Workspace {
  constructor(list: typeof PackageList = PackageList) {
    console.log("Hello Workspace!", list);
  }

  readonly path = ProjectRoot;

  join(...paths: string[]) {
    return this.path.join(...paths);
  }
}

export { pnpmWorkspaces };
