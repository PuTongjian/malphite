import type { Workspace } from "@malphite-tools/utils/workspace";
import type { BaseContext } from "clipanion";

export interface CliContext extends BaseContext {
  workspace: Workspace;
}
