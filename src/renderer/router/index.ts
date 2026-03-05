import { createRouter, createMemoryHistory } from "vue-router";
import SendPanel from "../views/SendPanel.vue";
import ReceivePanel from "../views/ReceivePanel.vue";
import ClipboardPanel from "../views/ClipboardPanel.vue";
import SettingsPanel from "../views/SettingsPanel.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: "/",
      redirect: "/send",
    },
    {
      path: "/send",
      name: "send",
      component: SendPanel,
    },
    {
      path: "/receive",
      name: "receive",
      component: ReceivePanel,
    },
    {
      path: "/clipboard",
      name: "clipboard",
      component: ClipboardPanel,
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsPanel,
    },
  ],
});

export default router;
