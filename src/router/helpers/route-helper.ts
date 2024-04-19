import type { RouteRecordRaw } from "vue-router";

abstract class Route implements RouteType.RouteInterface {
  readonly name: RouteType.RouteKey;
  readonly path: RouteType.RoutePath;
  readonly component: RouteType.RouteComponent;
  meta?: RouteType.RouteMeta;
  _children: RouteRecordRaw[];

  constructor(routeItem: RouteType.RouteItem) {
    const { name, path, component, meta } = routeItem;
    this.name = name;
    this.path = path;
    this.component = component;
    this.meta = meta;
    this._children = [];
  }

  set children(value: RouteRecordRaw[]) {
    this._children = value;
  }

  get children() {
    return this._children;
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
      meta,
      children: [
        {
          path: "",
          component: () => import("@/views/index/index.vue"),
          children: this.children
        }
      ]
    };
    return route;
  }
}

function routeFactory(routeItem: RouteType.RouteItem) {
  return new BasicRoute(routeItem);
}

export function transformToVueRoute(routeItem: RouteType.RouteItem[]) {
  // return [new BasicRoute(routeItem[0]).toVueRoute()] as RouteRecordRaw[];
  const vueRoutes: RouteRecordRaw[] = [];
  for (const item of routeItem) {
    const route = routeFactory(item);
    route.children = transformToVueRoute(item.children || []);
    const vueRoute = route.toVueRoute();
    vueRoutes.push(vueRoute);
  }

  return vueRoutes;
}
