<template>
  <n-config-provider>
    <slot />
  </n-config-provider>
</template>

<script setup lang="ts">
import { provide, reactive } from "vue";
import { configProviderInjectionKey } from "./context";
import { NConfigProvider } from "naive-ui";

const props = defineProps({
  theme: {
    type: String,
    default: "dark",
  },
  locale: {
    type: String,
    default: "zh-CN"
  },
});

const config = reactive({
  theme: props.theme,
  locale: props.locale,
});


function initConfig() {
  // const instance = getCurrentInstance();
  // if (instance) {
  //   instance.appContext.app.provide(configProviderInjectionKey, config);
  // }
  provide(configProviderInjectionKey, config);
}

initConfig();
</script>
