export interface PnpmDepInfo {
  from: string;
  version: string;
  path: string;
  resolved?: string;
}

export interface PnpmWorkspaceItem {
  name: string;
  path: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, PnpmDepInfo>;
  devDependencies?: Record<string, PnpmDepInfo>;
}
