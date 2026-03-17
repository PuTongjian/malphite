import { Package } from "./package";
import { ProjectRoot } from "./path";
import { PackageList, pnpmWorkspaces } from "./pnpm";
import type { PackageName } from "./workspace.gen";

export class Workspace {
  readonly packages: Package[];

  readonly path = ProjectRoot;

  constructor(list: typeof PackageList = PackageList) {
    console.log("Hello Workspace!", list);
    const packages = new Map<string, Package>();

    for (const meta of list) {
      try {
        const pkg = new Package(meta.name as PackageName, meta);
        pkg.workspace = this;
        packages.set(meta.path, pkg);
      } catch (error) {
        console.error(error);
      }
    }

    this.packages = Array.from(packages.values());
  }

  tryGetPackage(name: PackageName) {
    return this.packages.find((pkg) => pkg.name === name);
  }

  getPackage(name: PackageName) {
    const pkg = this.tryGetPackage(name);

    if (!pkg) {
      throw new Error(`Package ${name} not found in workspace`);
    }

    return pkg;
  }

  join(...paths: string[]) {
    return this.path.join(...paths);
  }
}

export { pnpmWorkspaces };
