<template>
  <div class="text-4" :class="{'test':`(1 + 2)${1}`}">
    Smiley Sans 得意黑是一款在人文观感和几何特征中寻找平衡的中文黑体
    <n-button
      attr-type="button"
      @click="onClick">
      2131231
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton } from "naive-ui";

const onClick = () => {
  window.$message?.info("hello world");
};

</script>

<style scoped>

</style>
