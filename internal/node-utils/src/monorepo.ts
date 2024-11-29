import { dirname } from "node:path";
import { findUpSync } from "find-up";
import {
  getPackagesSync as getPackagesSyncFunc,
  getPackages as getPackagesFunc
} from "@manypkg/get-packages";

/**
 * finds the root of the monorepo by locating the pnpm-lock.yaml file
 */
function findMonorepoRoot(cwd: string = process.cwd()) {
  const lockFile = findUpSync("pnpm-lock.yaml", {
    cwd,
    type: "file"
  });
  return dirname(lockFile || "");
}

/**
 * returns all packages in the monorepo
 */
async function getPackages() {
  const root = findMonorepoRoot();
  return await getPackagesFunc(root);
}

/**
 * returns all packages in the monorepo synchronously
 */
function getPackagesSync() {
  const root = findMonorepoRoot();
  return getPackagesSyncFunc(root);
}


export {
  findMonorepoRoot,
  getPackages,
  getPackagesSync
};
