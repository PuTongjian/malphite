import type { RouteRecordRaw } from "vue-router";
import { Component } from "vue";
import { views } from "@/views";
import { layouts } from "@/layout";


abstract class RouteHelper implements RouteType.RouteHelperInterface {
  readonly routeItem: RouteType.RouteItem;
  _children: RouteRecordRaw[];

  constructor(routeItem: RouteType.RouteItem) {
    this.routeItem = routeItem;
    this._children = [];
  }

  get children() {
    return this._children;
  }

  set children(children: RouteRecordRaw[]) {
    this._children = children;
  }

  async setComponentName(asyncComponent: Lazy<Component>, name: string) {
    const component = (await asyncComponent()) as { default: Component };
    Object.assign(component.default, { name });
    return component;
  }

  async getComponent(layoutType: RouteType.LayoutType) {
    if (layoutType === "self") return () => this.setComponentName(views[this.routeItem.name], this.routeItem.name) as Promise<Component>;
    else return () => this.setComponentName(layouts[layoutType], layoutType) as Promise<Component>;
  }

  abstract toVueRoute(): RouteRecordRaw;
}

class SelfRouteHelper extends RouteHelper {
  constructor(routeItem: RouteType.RouteItem) {
    super(routeItem);
  }

  toVueRoute() {
    // todo
    const vueRoute: RouteRecordRaw = {
      name: this.routeItem.name,
      path: this.routeItem.path,
      component: this.getComponent(this.routeItem.layout),
      meta: this.routeItem.meta? {...this.routeItem.meta}: {},
      children: this.children
    };
    return vueRoute;
  }
}

class LayoutRouteHelper extends RouteHelper {
  constructor(routeItem: RouteType.RouteItem) {
    super(routeItem);
  }

  toVueRoute() {
    // todo
    const vueRoute: RouteRecordRaw = {
      name: this.routeItem.name,
      path: this.routeItem.path,
      component: this.getComponent(this.routeItem.layout),
      children: [
        {
          path: "",
          component: this.getComponent("self"),
          children: this.children
        }
      ]
    };
    return vueRoute;
  }
}


class RouteHelperFactory {
  static create(routeItem: RouteType.RouteItem) {
    switch (routeItem.layout) {
      case "self":
        return new SelfRouteHelper(routeItem);
      case "basic":
        return new LayoutRouteHelper(routeItem);
    }
  }
}

export function transformToVueRoute(routeItems: RouteType.RouteItem[]) {
  const vueRoutes: RouteRecordRaw[] = [];
  for (const item of routeItems) {

    const route = RouteHelperFactory.create(item);
    route.children = transformToVueRoute(item.children || []);
    const vueRoute = route.toVueRoute();
    vueRoutes.push(vueRoute);
  }
  return vueRoutes;
}
