import { Logger } from "./logger";
import { Package } from "./package";
import { ProjectRoot } from "./path";
import { PackageList, pnpmWorkspaces } from "./pnpm";
import type { PackageName } from "./workspace.gen";

class CircularDependenciesError extends Error {
  constructor(public currentName: string) {
    super("Circular dependencies error");
  }
}

class ForbiddenPackageRefError extends Error {
  constructor(
    public currentName: string,
    public refName: string,
  ) {
    super(
      `Public package cannot reference private package. Found '${refName}' in dependencies of '${currentName}'`,
    );
  }
}

export class Workspace {
  readonly packages: Package[];

  readonly path = ProjectRoot;

  private readonly logger = new Logger("Malphite workspace");

  constructor(list: typeof PackageList = PackageList) {
    const packages = new Map<string, Package>();

    for (const meta of list) {
      try {
        const pkg = new Package(meta.name as PackageName, meta);
        pkg.workspace = this;
        packages.set(meta.path, pkg);
      } catch (e) {
        this.logger.error(e as Error);
      }
    }

    const building = new Set<string>();

    try {
      packages.forEach((pkg) => this.buildDeps(pkg, packages, building));
    } catch (e) {
      if (e instanceof CircularDependenciesError) {
        const inProcessPackages = Array.from(building);
        const circle = inProcessPackages
          .slice(inProcessPackages.indexOf(e.currentName))
          .concat(e.currentName);
        this.logger.error(
          `Circular dependencies found: \n ${circle.join(" -> ")}`,
        );
        process.exit(1);
      }

      throw e;
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
        throw new CircularDependenciesError(dep.name);
      }

      if (!pkg.packageJson.private && dep.packageJson.private) {
        throw new ForbiddenPackageRefError(pkg.name, dep.name);
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
