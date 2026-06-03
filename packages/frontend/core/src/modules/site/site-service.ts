import { LiveData } from "../../shared/live-data";

export class SiteService {
  title$ = new LiveData("Malphite!");

  rename(title: string) {
    this.title$.set(title);
  }
}
