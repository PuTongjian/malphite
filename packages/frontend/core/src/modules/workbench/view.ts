import { LiveData } from "~/src/shared/live-data";

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

  constructor(
    public readonly id: string,
    initialPath: string,
    public readonly title: string,
  ) {
    this.path$.set(normalizePath(initialPath));
  }

  get path() {
    return this.path$.value;
  }

  navigate(path: string) {
    this.path$.set(normalizePath(path));
  }
}

export function createView(path: string) {
  const normalizedPath = normalizePath(path);

  return new View(
    crypto.randomUUID(),
    normalizedPath,
    getViewTitle(normalizedPath),
  );
}

export const MAIN_VIEW = new View("main", "/all", "All Docs");
