import type { RouteRecordRaw } from "vue-router";
import { views } from "@/views";
import { layouts } from "@/layout";

/** 自定义路由转换类 */
abstract class RouteHelper {
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


  /**
   * Set the name of the component to the given name.
   * @param asyncComponent The lazy component to set the name of.
   * @param name The name to set.
   * @returns The component with the name set.
   */
  async setComponentName(asyncComponent: RouteType.LazyComponent, name: string): Promise<RouteType.ViewComponent> {
    const component = (await asyncComponent());
    Object.assign(component.default, { name });
    return component;
  }

  /**
   * Get the component for the given layout type.
   * @param layoutType The layout type to get the component for.
   * @returns The component for the given layout type.
   */
  getComponent(layoutType: RouteType.LayoutType): RouteType.LazyComponent {
    return layoutType === "self"
      ? () => this.setComponentName(views[this.routeItem.name], this.routeItem.name)
      : () => this.setComponentName(layouts[layoutType], layoutType);
  }

  abstract toVueRoute(): RouteRecordRaw;
}

/** 自定义布局路由转化类 */
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

/** 基础布局路由转化类 */
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

/** 路由工厂类 */
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

/**
 * Transforms an array of custom route items into an array of Vue routes.
 *
 * @param routeItems - The array of custom route items to transform.
 * @returns The array of Vue routes.
 */
export function transformToVueRoute(routeItems: RouteType.RouteItem[]): RouteRecordRaw[] {
  const vueRoutes: RouteRecordRaw[] = [];

  for (const item of routeItems) {
    const route = RouteHelperFactory.create(item);
    route.children = transformToVueRoute(item.children || []);
    const vueRoute = route.toVueRoute();
    vueRoutes.push(vueRoute);
  }

  return vueRoutes;
}
