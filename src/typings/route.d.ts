import type { RouteRecordRaw } from "vue-router";

declare namespace RouteType {
  /** 路由KEY */
  type RouteKey =
    | "index"

  /** 路由的完整路径 */
  type RoutePath =
   | "/"
   | Exclude<KeyToPath<RouteKey>, "/index">

  /**
   * 路由组件类型
   * frontend-layout - 前端基本布局页面
   * backend-layout - 后端基本布局页面
   * self - 自定义布局页面
  */
  type RouteComponent =
    | "frontend-layout"
    | "backend-layout"
    | "self"

  /** 路由描述 */
  type RouteMeta = {
    /** 路由标题 */
    title?: string;
    /** 缓存页面 */
    keepAlive?: boolean;
  }

  /** 自定义路由接口 */
  interface RouteInterface {
    /** 路由名称(路由唯一标识) */
    readonly name: RouteKey;
    /** 路由路径 */
    readonly path: RoutePath;
    /** 路由组件类型 */
    readonly component: RouteComponent;
    /** 子路由 */
    children: RouteRecordRaw[];
    /** 路由描述 */
    meta?: RouteMeta;
    /** 转换为vue路由 */
    toVueRoute: () => RouteRecordRaw;
  }

  /** 自定义路由配置项（JSON） */
  type RouteItem = {
    /** 路由名称(路由唯一标识)，根据此名称索引vue文件 */
    readonly name: RouteKey;
    /** 路由路径 */
    readonly path: RoutePath;
    /** 路由组件类型 */
    readonly component: RouteComponent;
    /** 子路由 */
    children?: RouteItem[];
    /** 路由描述 */
    meta?: RouteMeta;
  }

  type KeyToPath<Key extends string> = Key extends `${infer Left}_${infer Right}`
    ? KeyToPath<`${Left}/${Right}`>
    : `/${Key}`
}


export = RouteType;
export as namespace RouteType;
