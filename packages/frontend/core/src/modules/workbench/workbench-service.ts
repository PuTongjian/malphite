import { LiveData } from "~/src/shared/live-data";

export type View = {
  id: string;
  path: string;
};

export class WorkbenchService {
  views$ = new LiveData<View[]>([{ id: "main", path: "/all" }]);
  activeViewId$ = new LiveData("main");

  open(path: string) {
    const view = {
      id: crypto.randomUUID(),
      path,
    };

    this.views$.set([...this.views$.value, view]);
    this.activeViewId$.set(view.id);
  }

  close(id: string) {
    const next = this.views$.value.filter((view) => view.id !== id);
    this.views$.set(next);
    this.activeViewId$.set(next[0]?.id ?? "");
  }
}
