declare namespace Env {
  /** Interface for import.meta */
  interface CustomImportMetaEnv extends ImportMetaEnv {
    /** The base url of the application */
    readonly VITE_BASE_URL: string
    /** The base url of the backend service */
    readonly VITE_SERVICE_BASE_URL: string
    /** the home route key */
    readonly VITE_ROUTE_HOME: import("@elegant-router/types").LastLevelRouteKey
  }
}

interface ImportMeta {
  readonly env: Env.CustomImportMetaEnv
}
