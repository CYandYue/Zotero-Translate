import { getString } from "../utils/locale";

export function registerMenu() {
  ztoolkit.Menu.unregister("zotero-itemmenu-babeldoc-translate");
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
  // item menuitem with icon
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-babeldoc-translate",
    label: getString("menuitem-translate"),
    commandListener: () => addon.hooks.onTranslate(),
    icon: menuIcon,
  });
}

export function registerWindowMenu() {
  ztoolkit.Menu.unregister("zotero-menuview-babeldoc-translate-separator");
  ztoolkit.Menu.unregister("zotero-menuview-babeldoc-translate-menuitem");
  ztoolkit.Menu.register("menuView", {
    id: "zotero-menuview-babeldoc-translate-separator",
    tag: "menuseparator",
  });
  // menu->File menuitem
  ztoolkit.Menu.register("menuView", {
    id: "zotero-menuview-babeldoc-translate-menuitem",
    tag: "menuitem",
    label: getString("menuView-tasks"),
    commandListener: () => addon.hooks.onViewTranslationTasks(),
  });
}
