import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import App from "./App.vue";
import router from "./router";
import "./assets/styles.css";
import "./assets/theme-override.css";

// Customize Element Plus theme variables for dark mode
const setDarkTheme = () => {
  const root = document.documentElement;
  root.style.setProperty("--el-bg-color", "#0a0a0a");
  root.style.setProperty("--el-bg-color-page", "#0a0a0a");
  root.style.setProperty("--el-bg-color-overlay", "#1a1a1a");
  root.style.setProperty("--el-fill-color", "#1a1a1a");
  root.style.setProperty("--el-fill-color-light", "#222222");
  root.style.setProperty("--el-fill-color-lighter", "#2a2a2a");
  root.style.setProperty("--el-fill-color-extra-light", "#333333");
  root.style.setProperty("--el-border-color", "rgba(255, 255, 255, 0.08)");
  root.style.setProperty("--el-border-color-light", "rgba(255, 255, 255, 0.06)");
  root.style.setProperty("--el-border-color-lighter", "rgba(255, 255, 255, 0.04)");
  root.style.setProperty("--el-border-color-extra-light", "rgba(255, 255, 255, 0.02)");
  root.style.setProperty("--el-text-color-primary", "#ffffff");
  root.style.setProperty("--el-text-color-regular", "#a0a0a0");
  root.style.setProperty("--el-text-color-secondary", "#666666");
  root.style.setProperty("--el-text-color-placeholder", "#666666");

  // Override primary color to white/gray
  root.style.setProperty("--el-color-primary", "#ffffff");
  root.style.setProperty("--el-color-primary-light-3", "#333333");
  root.style.setProperty("--el-color-primary-light-5", "#444444");
  root.style.setProperty("--el-color-primary-light-7", "#555555");
  root.style.setProperty("--el-color-primary-light-8", "#666666");
  root.style.setProperty("--el-color-primary-light-9", "#777777");
  root.style.setProperty("--el-color-primary-dark-2", "#cccccc");

  root.style.setProperty("--el-color-success", "#00cc66");
  root.style.setProperty("--el-color-error", "#ff3366");
  root.style.setProperty("--el-border-radius-base", "6px");
  root.style.setProperty("--el-border-radius-small", "4px");
  root.style.setProperty("--el-border-radius-round", "8px");
  root.style.setProperty("--el-transition-duration", "0.15s");
  root.style.setProperty("--el-transition-duration-fast", "0.1s");
};

// Customize Element Plus theme variables for light mode
const setLightTheme = () => {
  const root = document.documentElement;
  root.style.setProperty("--el-bg-color", "#ffffff");
  root.style.setProperty("--el-bg-color-page", "#fafafa");
  root.style.setProperty("--el-bg-color-overlay", "#ffffff");
  root.style.setProperty("--el-fill-color", "#f5f5f5");
  root.style.setProperty("--el-fill-color-light", "#eeeeee");
  root.style.setProperty("--el-fill-color-lighter", "#e8e8e8");
  root.style.setProperty("--el-fill-color-extra-light", "#e0e0e0");
  root.style.setProperty("--el-border-color", "rgba(0, 0, 0, 0.08)");
  root.style.setProperty("--el-border-color-light", "rgba(0, 0, 0, 0.06)");
  root.style.setProperty("--el-border-color-lighter", "rgba(0, 0, 0, 0.04)");
  root.style.setProperty("--el-border-color-extra-light", "rgba(0, 0, 0, 0.02)");
  root.style.setProperty("--el-text-color-primary", "#0a0a0a");
  root.style.setProperty("--el-text-color-regular", "#666666");
  root.style.setProperty("--el-text-color-secondary", "#999999");
  root.style.setProperty("--el-text-color-placeholder", "#999999");

  // Override primary color to black/gray
  root.style.setProperty("--el-color-primary", "#0a0a0a");
  root.style.setProperty("--el-color-primary-light-3", "#cccccc");
  root.style.setProperty("--el-color-primary-light-5", "#dddddd");
  root.style.setProperty("--el-color-primary-light-7", "#eeeeee");
  root.style.setProperty("--el-color-primary-light-8", "#f5f5f5");
  root.style.setProperty("--el-color-primary-light-9", "#fafafa");
  root.style.setProperty("--el-color-primary-dark-2", "#333333");

  root.style.setProperty("--el-color-success", "#00cc66");
  root.style.setProperty("--el-color-error", "#ff3366");
  root.style.setProperty("--el-border-radius-base", "6px");
  root.style.setProperty("--el-border-radius-small", "4px");
  root.style.setProperty("--el-border-radius-round", "8px");
  root.style.setProperty("--el-transition-duration", "0.15s");
  root.style.setProperty("--el-transition-duration-fast", "0.1s");
};

// Apply initial theme (default to dark)
document.documentElement.classList.add("dark");
setDarkTheme();

// Watch for theme changes
let isUpdating = false;
const observer = new MutationObserver((mutations) => {
  if (isUpdating) return;

  mutations.forEach((mutation) => {
    if (mutation.attributeName === "class") {
      isUpdating = true;
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        setDarkTheme();
      } else {
        setLightTheme();
      }
      isUpdating = false;
    }
  });
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.mount("#app");
