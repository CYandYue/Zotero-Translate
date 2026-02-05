/**
 * BabelDOC Local Translation
 * Uses locally installed BabelDOC CLI to translate PDFs
 */

import { TranslationTaskData } from "../types";
import { getPref } from "../utils/prefs";
import { updateTaskInList } from "../modules/translate/task-manager";

/**
 * Translate PDF using local BabelDOC CLI
 */
export async function translatePDFWithBabelDOC(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
): Promise<void> {
  const attachmentId = taskData.attachmentId;
  const attachmentPath = taskData.attachmentPath;
  const attachmentFilename = taskData.attachmentFilename;
  const targetLanguage = taskData.targetLanguage;

  try {
    // Update status: Starting translation
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "preparing",
      progress: 10,
    });

    ztoolkit.log(`Starting BabelDOC translation for: ${attachmentFilename}`);

    // Get API configuration
    const provider = getPref("customProvider") as string;
    const apiKey = getPref("customApiKey") as string;
    const model = getPref("customModel") as string;
    const babeldocPath = getPref("babeldocPath") as string || "babeldoc";

    if (!apiKey) {
      throw new Error("API key not configured");
    }

    // Prepare output path
    const outputDir = PathUtils.parent(attachmentPath) || "";
    // Use actual filename from file path, not attachmentFilename (which may differ)
    const actualFilename = PathUtils.filename(attachmentPath);
    const baseName = actualFilename.replace(/\.pdf$/i, "");

    ztoolkit.log(`Processing file: ${actualFilename}, base name: ${baseName}, output dir: ${outputDir}`);

    // Build BabelDOC command
    const args: string[] = [];

    // Add provider-specific arguments
    if (provider === "openai") {
      args.push("--openai");
      args.push("--openai-api-key");
      args.push(apiKey);
      args.push("--openai-base-url");
      args.push("https://api.openai.com/v1");
      if (model) {
        args.push("--openai-model");
        args.push(model);
      } else {
        args.push("--openai-model");
        args.push("gpt-4o-mini");
      }
    } else if (provider === "deepseek") {
      args.push("--openai"); // DeepSeek uses OpenAI-compatible API
      args.push("--openai-api-key");
      args.push(apiKey);
      args.push("--openai-base-url");
      args.push("https://api.deepseek.com/v1");
      if (model) {
        args.push("--openai-model");
        args.push(model);
      } else {
        args.push("--openai-model");
        args.push("deepseek-chat");
      }
    }

    // Add target language (BabelDOC uses --lang-out)
    args.push("--lang-out");
    args.push(mapZoteroLanguageToBabelDOC(targetLanguage));

    // Add output directory
    args.push("--output");
    args.push(outputDir);

    // Add input file (must be last)
    args.push("--files");
    args.push(attachmentPath);

    ztoolkit.log(`Running BabelDOC command: ${babeldocPath} ${args.join(" ")}`);

    // Update status: Translating
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "translating",
      progress: 30,
    });

    // Execute BabelDOC command
    const result = await runBabelDOCCommand(babeldocPath, args);

    if (!result.success) {
      throw new Error(`BabelDOC failed: ${result.error}`);
    }

    ztoolkit.log(`BabelDOC command finished successfully`);

    // Update status: Importing result
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "importing",
      progress: 90,
    });

    // BabelDOC generates files with language code and _dual.pdf suffix
    // Format: filename.{lang}.dual.pdf or filename.{lang}.mono.pdf
    const langCode = mapZoteroLanguageToBabelDOC(targetLanguage);
    const possibleOutputNames = [
      `${baseName}.${langCode}.dual.pdf`,     // BabelDOC format with language code
      `${baseName}.${langCode}.mono.pdf`,     // BabelDOC monolingual with language code
      `${baseName}_dual.pdf`,                 // Legacy format
      `${baseName}_mono.pdf`,
      `${baseName}_translated.pdf`,
    ];

    let actualOutputPath: string | null = null;
    for (const outputName of possibleOutputNames) {
      const testPath = PathUtils.join(outputDir, outputName);
      ztoolkit.log(`Checking for output file: ${testPath}`);
      const exists = await IOUtils.exists(testPath);
      if (exists) {
        actualOutputPath = testPath;
        ztoolkit.log(`Found output file: ${actualOutputPath}`);
        break;
      }
    }

    if (!actualOutputPath) {
      // List files in output directory for debugging
      try {
        const files = await IOUtils.getChildren(outputDir);
        ztoolkit.log(`Files in output directory: ${files.join(", ")}`);
      } catch (e) {
        ztoolkit.log(`Could not list output directory: ${e}`);
      }
      throw new Error(`Output file not found. Expected one of: ${possibleOutputNames.join(", ")}`);
    }

    // Import translated PDF as attachment
    const resultAttachment = await Zotero.Attachments.importFromFile({
      file: actualOutputPath,
      parentItemID: taskData.parentItemId || undefined,
      collections: taskData.parentItemId
        ? undefined
        : Zotero.Items.get(taskData.attachmentId).getCollections(),
      libraryID: parentItem?.libraryID,
      title: PathUtils.filename(actualOutputPath),
    });

    resultAttachment.setTags(["BabelDOC_translated", "Local_Translation"]);
    await resultAttachment.saveTx();

    ztoolkit.log(`Imported translated PDF with ID: ${resultAttachment.id}`);

    // Update status: Success
    updateTaskInList(attachmentId, {
      status: "success",
      stage: "completed",
      progress: 100,
      resultAttachmentId: resultAttachment.id,
    });

    ztoolkit.log(`Translation task completed: ${attachmentFilename}`);

    // Auto open if configured
    if (getPref("autoOpenPDF")) {
      Zotero.Reader.open(resultAttachment.id);
    }
  } catch (error: any) {
    ztoolkit.log(`BabelDOC translation error for ${attachmentFilename}:`, error);
    updateTaskInList(attachmentId, {
      status: "failed",
      error: error.message || "Translation failed",
    });
    throw error;
  }
}

/**
 * Execute BabelDOC command
 */
async function runBabelDOCCommand(
  command: string,
  args: string[],
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    // Use Zotero's exec to run the command
    // @ts-ignore - Components API types are incomplete
    const proc = Components.classes["@mozilla.org/process/util;1"]
      .createInstance(Components.interfaces.nsIProcess);

    // Try to find the command
    let executableFile: any;

    try {
      // First try direct path
      // @ts-ignore - Components API types are incomplete
      executableFile = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      executableFile.initWithPath(command);

      if (!executableFile.exists()) {
        throw new Error("Not found");
      }
    } catch (e) {
      // If direct path fails, try to find in PATH
      // Try common installation locations across different systems
      const possiblePaths = [
        "/usr/local/bin/babeldoc",           // macOS Homebrew/manual install
        "/usr/bin/babeldoc",                 // Linux system install
        "/opt/homebrew/bin/babeldoc",        // macOS ARM Homebrew
        "~/.local/bin/babeldoc",             // User-local Python install (will be expanded)
        command, // Try as-is (might be in PATH)
      ];

      ztoolkit.log(`Searching for babeldoc in common locations: ${possiblePaths.join(", ")}`);

      let found = false;
      for (const path of possiblePaths) {
        try {
          // @ts-ignore - Components API types are incomplete
          executableFile = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsIFile);
          executableFile.initWithPath(path);
          if (executableFile.exists()) {
            found = true;
            ztoolkit.log(`Found babeldoc at: ${path}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!found) {
        throw new Error(
          `BabelDOC not found. Please install it using: uv tool install --python 3.12 BabelDOC\n` +
          `Or specify the full path in settings.`
        );
      }
    }

    proc.init(executableFile);

    // Run the process asynchronously (non-blocking)
    return new Promise((resolve) => {
      // Create observer to monitor process completion
      const observer = {
        observe: function(subject: any, topic: string, data: string) {
          if (topic === "process-finished") {
            const exitCode = proc.exitValue;
            ztoolkit.log(`BabelDOC process finished with exit code: ${exitCode}`);

            if (exitCode === 0) {
              resolve({ success: true });
            } else {
              resolve({
                success: false,
                error: `BabelDOC exited with code ${exitCode}`
              });
            }
          } else if (topic === "process-failed") {
            ztoolkit.log(`BabelDOC process failed: ${data}`);
            resolve({
              success: false,
              error: `BabelDOC process failed: ${data}`
            });
          }
        }
      };

      // Run process asynchronously
      try {
        proc.runAsync(args, args.length, observer);
        ztoolkit.log("BabelDOC process started asynchronously");
      } catch (error: any) {
        ztoolkit.log("Failed to start BabelDOC process:", error);
        resolve({
          success: false,
          error: error.message || "Failed to start BabelDOC process"
        });
      }
    });
  } catch (error: any) {
    ztoolkit.log("BabelDOC execution error:", error);
    return {
      success: false,
      error: error.message || "Failed to execute BabelDOC",
    };
  }
}

/**
 * Map Zotero language codes to BabelDOC language codes
 */
function mapZoteroLanguageToBabelDOC(zoteroLang: string): string {
  const langMap: Record<string, string> = {
    "zh-CN": "zh",
    "zh-TW": "zh-TW",
    "en-US": "en",
    "ja-JP": "ja",
    "ko-KR": "ko",
    "fr-FR": "fr",
    "de-DE": "de",
    "es-ES": "es",
    "ru-RU": "ru",
    "ar-SA": "ar",
  };

  return langMap[zoteroLang] || zoteroLang.split("-")[0];
}

/**
 * Test BabelDOC installation
 */
export async function testBabelDOCInstallation(
  babeldocPath?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const path = babeldocPath || "babeldoc";
    const result = await runBabelDOCCommand(path, ["--help"]);

    if (result.success) {
      return {
        success: true,
        message: "BabelDOC is installed and working!",
      };
    } else {
      return {
        success: false,
        message: result.error || "BabelDOC test failed",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to test BabelDOC",
    };
  }
}
