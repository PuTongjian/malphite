import type { RouteRecordRaw } from "vue-router";

declare namespace RouteType {
  /** 路由KEY */
  type RouteKey =
    | "index"

  /** 路由的完整路径 */
  type RoutePath =
   | "/"
   | KeyToPath<RouteKey>

  /** 路由组件类型 */
  type RouteComponent =
    | "layout"
    | "self"

  /** 路由描述 */
  type RouteMeta = {
    /** 路由标题 */
    title?: string;
    /** 缓存页面 */
    keepAlive?: boolean;
  }
  /** 自定义路由类型 */
  interface RouteInterface {
    /** 路由名称(路由唯一标识) */
    name: RouteKey;
    /** 路由路径 */
    path: RoutePath;
    /** 路由组件类型 */
    component: RouteComponent;
    /** 子路由 */
    children?: RouteInterface[];
    /** 路由描述 */
    meta?: RouteMeta;
    /** 转换为vue路由 */
    toVueRoute: () => RouteRecordRaw;
  }

  /** 自定义路由配置（JSON） */
  type RouteItem = WithoutMethods<RouteInterface>;

  type KeyToPath<Key extends string> = Key extends `${infer Left}_${infer Right}`
    ? KeyToPath<`${Left}/${Right}`>
    : `/${Key}`
}


export = RouteType;
export as namespace RouteType;
