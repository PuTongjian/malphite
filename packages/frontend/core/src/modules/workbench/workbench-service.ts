import { LiveData } from "~/src/shared/live-data";

export type View = {
  id: string;
  path: string;
  title: string;
};

const MAIN_VIEW: View = {
  id: "main",
  path: "/all",
  title: "All Docs",
};

function normalizePath(path: string) {
  if (path === "" || path === "/") {
    return "/all";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function getViewTitle(path: string) {
  if (path === "/all") {
    return "All Docs";
  }

  if (path === "/settings") {
    return "Settings";
  }

  return path.slice(1);
}

function createView(path: string): View {
  const normalizedPath = normalizePath(path);

  return {
    id: crypto.randomUUID(),
    path: normalizedPath,
    title: getViewTitle(normalizedPath),
  };
}

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  open(path: string) {
    console.log("Opening view with path:", path);
    const normalizedPath = normalizePath(path);
    const existing = this.views$.value.find((view) => {
      return view.path === normalizedPath;
    });

    if (existing) {
      this.activeViewId$.set(existing.id);
      return existing;
    }

    const view = createView(normalizedPath);

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);

    return view;
  }

  activate(id: string) {
    const exists = this.views$.value.some((view) => {
      return view.id === id;
    });

    if (exists) {
      this.activeViewId$.set(id);
    }
  }

  close(id: string) {
    const views = this.views$.value;

    if (views.length <= 1) {
      return;
    }

    const closedIndex = views.findIndex((view) => {
      return view.id === id;
    });

    if (closedIndex === -1) {
      return;
    }

    const nextViews = views.filter((view) => {
      return view.id !== id;
    });

    this.views$.set(nextViews);

    if (this.activeViewId$.value === id) {
      const nextActiveView =
        nextViews[Math.min(closedIndex, nextViews.length - 1)];
      this.activeViewId$.set(nextActiveView?.id ?? "");
    }
  }
}
