import { Package } from "./package";
import { ProjectRoot } from "./path";
import { PackageList, pnpmWorkspaces } from "./pnpm";
import type { PackageName } from "./workspace.gen";

export class Workspace {
  readonly packages: Package[];

  readonly path = ProjectRoot;

  constructor(list: typeof PackageList = PackageList) {
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

    const building = new Set<string>();

    try {
      packages.forEach((pkg) => this.buildDeps(pkg, packages, building));
    } catch (e) {
      console.error(e);
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

  buildDeps(
    pkg: Package,
    packages: Map<string, Package>,
    building: Set<string>,
  ) {
    if (pkg.deps.length) {
      return;
    }

    building.add(pkg.name);

    pkg.deps = pkg.workspaceDependencies.map((relativeDepPath) => {
      const dep = packages.get(relativeDepPath);

      if (!dep) {
        throw new Error(`Dependency ${relativeDepPath} not found in workspace`);
      }

      if (building.has(dep.name)) {
        throw new Error(
          `Circular dependency detected: ${pkg.name} -> ${dep.name}`,
        );
      }

      if (!pkg.packageJson.private && dep.packageJson.private) {
        console.warn(
          `Warning: Public package "${pkg.name}" depends on private package "${dep.name}"`,
        );
      }

      this.buildDeps(dep, packages, building);

      return dep;
    });

    building.delete(pkg.name);
  }

  join(...paths: string[]) {
    return this.path.join(...paths);
  }
}

export { pnpmWorkspaces, Package };
