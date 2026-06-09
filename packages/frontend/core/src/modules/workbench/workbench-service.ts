import type { FrameworkProvider } from "~/src/framework/framework";
import { LiveData } from "~/src/shared/live-data";
import { getViewTitle, MAIN_VIEW, normalizePath, View } from "./view";

export class WorkbenchService {
  views$ = new LiveData<View[]>([MAIN_VIEW]);
  activeViewId$ = new LiveData(MAIN_VIEW.id);

  constructor(private provider: FrameworkProvider) {}

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

    const view = this.provider.createEntity(View, {
      initialPath: normalizedPath,
      title: getViewTitle(normalizedPath),
    });

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

    if (views.length <= 1) return;

    const closedIndex = views.findIndex((view) => view.id === id);
    if (closedIndex === -1) return;

    const nextViews = views.filter((view) => view.id !== id);
    this.views$.set(nextViews);

    const closeView = views[closedIndex];
    closeView.dispose();

    if (this.activeViewId$.value === id) {
      const nextActiveView =
        nextViews[Math.min(closedIndex, nextViews.length - 1)];
      this.activeViewId$.set(nextActiveView?.id ?? "");
    }
  }
}
