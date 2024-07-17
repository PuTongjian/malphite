import { Component } from "vue";

declare namespace RouteType {
  /** 路由KEY */
  type RouteKey =
    | "index"

  /** 路由的完整路径 */
  type RoutePath =
   | "/"
   | Exclude<KeyToPath<RouteKey>, "/index">


  type LazyComponent = () => Promise<{ default: Component }>;

  /** 路由视图组件Key-Component */
  type ViewComponentDic = Record<RouteKey, LazyComponent>;

  /**
   * 路由布局类型
   * basic - 基础（默认）布局页面
   * self - 自定义布局页面
  */
  type LayoutType =
    | "basic"
    | "self"

  /** 路由布局组件Key-Component */
  type LayoutComponentDic = Record<Exclude<LayoutType, "self">, LazyComponent>;

  /** 路由描述 */
  interface RouteMeta {
    /** 路由标题 */
    title?: string;
    /** 缓存页面 */
    keepAlive?: boolean;
  }

  /** 自定义路由配置项（JSON） */
  interface RouteItem {
    /** 路由名称(路由唯一标识)，根据此名称索引vue文件 */
    readonly name: RouteKey;
    /** 路由路径 */
    readonly path: RoutePath;
    /** 路由组件类型 */
    readonly layout: LayoutType;
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
