import type { RouteRecordRaw } from "vue-router";

abstract class BaseRoute implements RouteType.RouteInterface {
  readonly name: RouteType.RouteKey;
  readonly path: RouteType.RoutePath;
  readonly layout: RouteType.LayoutType;
  meta?: RouteType.RouteMeta;
  private _component: RouteType.RawRouteComponent;
  private _children: BaseRoute[];

  constructor(routeItem: RouteType.RouteItem) {
    const { name, path, layout, meta } = routeItem;
    this.name = name;
    this.path = path;
    this.layout = layout;
    this.meta = meta;
    this._component = () => {};
    this._children = [];
  }

  set component(value: RouteType.RawRouteComponent) {
    this._component = value;
  }

  get component() {
    return this._component;
  }

  set children(value: BaseRoute[]) {
    this._children = value;
  }

  get children() {
    return this._children;
  }

  abstract toVueRoute(): RouteRecordRaw;
}

class Route extends BaseRoute {
  constructor(routeItem: RouteType.RouteItem) {
    super(routeItem);
  }

  toVueRoute() {
    const { name, path, meta } = this;
    const route: RouteRecordRaw = {
      name,
      path,
      component: this.component,
      meta,
      children: this.children
    };
    return route;
  }
}

// class LayoutRoute extends BaseRoute {
//   constructor(routeItem: RouteType.RouteItem) {
//     super(routeItem);
//   }

//   toVueRoute() {
//     const { name, path, meta } = this;
//     const route: RouteRecordRaw = {
//       name,
//       path,
//       component: this.component,
//       meta,
//       children: this.children
//     };
//     return route;
//   }
// }

function routeFactory(routeItem: RouteType.RouteItem) {
  return new Route(routeItem);
}

export function transformToVueRoute(routeItem: RouteType.RouteItem[]) {
  // return [new BasicRoute(routeItem[0]).toVueRoute()] as RouteRecordRaw[];
  const vueRoutes: RouteRecordRaw[] = [];
  for (const item of routeItem) {
    const route = routeFactory(item);
    // route.children = transformToVueRoute(item.children || []);
    const vueRoute = route.toVueRoute();
    vueRoutes.push(vueRoute);
  }

  return vueRoutes;
}
