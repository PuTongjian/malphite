import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { once } from "lodash-es";
import type { PnpmPackageJsonContent } from "./types";
import type { PackageName } from "./workspace.gen";

function getWorkspaceDependencies(
  pkg: PnpmPackageJsonContent,
  cwd: string,
): string[] {
  const deps = [pkg.dependencies, pkg.devDependencies];
  return deps.flatMap((d) =>
    d
      ? Object.entries(d)
          .filter(([, info]) => info?.version?.startsWith("link:"))
          .map(([, info]) => path.relative(cwd, info?.path).replace(/\\/g, "/"))
      : [],
  );
}

export const pnpmWorkspaces = once(() => {
  const cwd = process.cwd();

  // use --depth=0 to get the dependencies/devDependencies
  const output = execSync("pnpm ls -r --depth=0 --json", {
    cwd,
    encoding: "utf8",
  });

  const pnpmList = JSON.parse(output) as PnpmPackageJsonContent[];

  return pnpmList
    .filter((pkg) => path.resolve(pkg.path) !== cwd)
    .map((pkg) => ({
      name: pkg.name,
      path: path.relative(cwd, pkg.path).replace(/\\/g, "/"),
      workspaceDependencies: getWorkspaceDependencies(pkg, cwd),
    }));
});

async function loadPackageList() {
  try {
    const packageList = await import("./workspace.gen");
    return packageList.PackageList;
  } catch {
    return [];
  }
}

export const PackageList = await loadPackageList();
export type { PackageName };
