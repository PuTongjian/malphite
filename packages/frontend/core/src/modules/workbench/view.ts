import { LiveData } from "~/src/shared/live-data";

export type ViewProps = {
  initialPath: string;
  title: string;
};

export function normalizePath(path: string) {
  if (path === "" || path === "/") {
    return "/all";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function getViewTitle(path: string) {
  if (path === "/all") {
    return "All Docs";
  }

  if (path === "/settings") {
    return "Settings";
  }

  return path.slice(1);
}

export class View {
  path$ = new LiveData("");
  readonly title: string;

  constructor(
    public readonly id: string,
    props: ViewProps,
  ) {
    this.path$.set(normalizePath(props.initialPath));
    this.title = props.title;
  }

  get path() {
    return this.path$.value;
  }

  navigate(path: string) {
    this.path$.set(normalizePath(path));
  }

  dispose() {
    // 后续 D 阶段会在这里清理 history/router 订阅
  }
}

export const MAIN_VIEW = new View("main", {
  initialPath: "/all",
  title: "All Docs",
});
