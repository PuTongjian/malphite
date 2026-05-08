export interface PnpmDepInfo {
  from: string;
  version: string;
  path: string;
  resolved?: string;
}

export interface PnpmPackageJsonContent {
  name: string;
  path: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, PnpmDepInfo>;
  devDependencies?: Record<string, PnpmDepInfo>;
}

export interface PnpmWorkspaceItem {
  name: string;
  path: string;
  workspaceDependencies: string[];
}

export interface CommonPackageJsonContent {
  name: string;
  type?: "module" | "commonjs";
  version: string;
  private?: boolean;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  scripts?: { [key: string]: string };
  main?: string;
  exports?: { [key: string]: string | { [key: string]: string } };
}
