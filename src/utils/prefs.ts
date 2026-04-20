import { config } from "../../package.json";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

const PREFS_PREFIX = config.prefsPrefix;
const LEGACY_PREFS_PREFIX = "extensions.zotero.immersivetranslate";

const MIGRATED_PREF_KEYS = [
  "targetLanguage",
  "translateMode",
  "autoTranslate",
  "autoOpenPDF",
  "customSystemPrompt",
  "enableShortcuts",
  "customProvider",
  "customApiKey",
  "customModel",
  "useBabelDOC",
  "babeldocPath",
] as const satisfies readonly (keyof PluginPrefsMap)[];

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref<K extends keyof PluginPrefsMap>(key: K) {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref<K extends keyof PluginPrefsMap>(
  key: K,
  value: PluginPrefsMap[K],
) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

/**
 * Clear preference value.
 * Wrapper of `Zotero.Prefs.clear`.
 * @param key
 */
export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${key}`, true);
}

export function migrateLegacyPrefs() {
  if (PREFS_PREFIX === LEGACY_PREFS_PREFIX) {
    return;
  }

  const migratedMarker = "legacyPrefsMigrated";
  if (Zotero.Prefs.get(`${PREFS_PREFIX}.${migratedMarker}`, true)) {
    return;
  }

  for (const key of MIGRATED_PREF_KEYS) {
    const legacyValue = Zotero.Prefs.get(
      `${LEGACY_PREFS_PREFIX}.${key}`,
      true,
    ) as PluginPrefsMap[typeof key] | undefined;

    if (legacyValue === undefined || legacyValue === "") {
      continue;
    }

    setPref(key, legacyValue);
  }

  setPref("useLocalTranslation", true);
  Zotero.Prefs.set(`${PREFS_PREFIX}.${migratedMarker}`, true, true);
}
