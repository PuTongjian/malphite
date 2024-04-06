declare namespace Route {
  /** 路由KEY */
  type RouteKey =
    | "index"

  type RoutePath =
  | "/"
  | "index"

  interface RouteInterface {
    /** 路由名称(路由唯一标识) */
    name: RouteKey;
    path: RoutePath
  }

  // type KeyTOPath<Key extends string> =
}