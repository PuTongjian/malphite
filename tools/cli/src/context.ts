import type { BaseContext } from "clipanion";

export interface CliContext extends BaseContext {
  workspace: string;
}
