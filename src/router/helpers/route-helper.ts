import type { RouteRecordRaw } from "vue-router";


abstract class Route implements RouteType.RouteInterface {
  readonly name: RouteType.RouteKey;
  readonly path: RouteType.RoutePath;
  readonly component: RouteType.RouteComponent;
  children?: RouteType.RouteInterface[];
  meta?: RouteType.RouteMeta;

  constructor(routeItem: RouteType.RouteItem) {
    const { name, path, component, children, meta } = routeItem;
    this.name = name;
    this.path = path;
    this.component = component;
    this.children = children;
    this.meta = meta;
  }

  abstract toVueRoute(): RouteRecordRaw;
}

class BasicRoute extends Route {
  constructor(routeItem: RouteType.RouteItem) {
    super(routeItem);
  }
  toVueRoute() {
    const { name, path, meta } = this;
    const route: RouteRecordRaw = {
      name,
      path,
      component: () => import("@/layout/index.vue"),
      meta
    };
    return route;
  }
}


export function transformToVueRoute(routeItem: RouteType.RouteItem[]) {
  return [new BasicRoute(routeItem[0]).toVueRoute()] as RouteRecordRaw[];
}
