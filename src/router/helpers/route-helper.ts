import type { RouteRecordRaw } from "vue-router";

abstract class Route implements RouteType.RouteInterface {
  readonly name: RouteType.RouteKey;
  readonly path: RouteType.RoutePath;
  readonly component: RouteType.RouteComponent;
  meta?: RouteType.RouteMeta;

  constructor(routeItem: RouteType.RouteItem) {
    const { name, path, component, meta } = routeItem;
    this.name = name;
    this.path = path;
    this.component = component;
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
      meta,
      children: [
        {
          path: "",
          component: () => import("@/views/index/index.vue"),
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
  const vueRoutes = [];
  for (const item of routeItem) {
    const vueRoute = routeFactory(item).toVueRoute();

    // 带修改
    vueRoute.children = transformToVueRoute(item.children || []);
    vueRoutes.push(vueRoute);
  }

  return vueRoutes;
}
