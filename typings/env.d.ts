/// <reference types="vite/client" />

declare namespace Env {
  /** Interface for import.meta */
  interface CustomImportMetaEnv extends ImportMetaEnv {
    /** The base url of the application */
    readonly VITE_BASE_URL: string
    /** The base url of the backend service */
    readonly VITE_SERVICE_BASE_URL: string
  }
}

interface ImportMeta {
  env: Env.CustomImportMetaEnv
}
