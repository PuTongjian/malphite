import { InjectionKey } from "vue";

export interface ConfigProvider {
  theme?: string;
  locale?: string;
}

export const configProviderInjectionKey: InjectionKey<ConfigProvider> = Symbol("ConfigProvider");
