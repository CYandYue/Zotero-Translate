import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: "dist",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  // updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
  //   pkg.version.includes("-") ? "update-beta.json" : "update.json"
  // }`,
  xpiName: pkg.config.xpiName,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
          __NEW_GA_MEASUREMENT_ID__: `"${process.env.NEW_GA_MEASUREMENT_ID}"`,
          __NEW_GA_API_SECRET__: `"${process.env.NEW_GA_API_SECRET}"`,
          __OLD_GA_MEASUREMENT_ID__: `"${process.env.OLD_GA_MEASUREMENT_ID}"`,
          __OLD_GA_API_SECRET__: `"${process.env.OLD_GA_API_SECRET}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `dist/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
