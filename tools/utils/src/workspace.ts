import { pnpmWorkspaces } from "./pnpm";

export class Workspace {
  constructor(list: any) {
    console.log("Hello Workspace!", list);
  }
}

export { pnpmWorkspaces };
