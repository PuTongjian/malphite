import { LiveData } from "~/src/shared/live-data";
import { createView, MAIN_VIEW, normalizePath, type View } from "./view";

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  get activeView() {
    return (
      this.views$.value.find((view) => view.id === this.activeViewId$.value) ??
      this.views$.value[0]
    );
  }

  open(path: string) {
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
