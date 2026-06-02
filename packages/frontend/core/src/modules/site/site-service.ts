import { LiveState } from "../../shared/live-state";

export class SiteService {
  title$ = new LiveState("Malphite!");

  rename(title: string) {
    this.title$.set(title);
  }
}
