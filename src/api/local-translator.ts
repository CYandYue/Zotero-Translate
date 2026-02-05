/**
 * Local Translation Service
 * Replaces the remote Immersive Translate service with local translation
 */

import { TranslationTaskData } from "../types";
import { getPref } from "../utils/prefs";
import { updateTaskInList } from "../modules/translate/task-manager";
import { translatePDFWithBabelDOC } from "./babeldoc-translator";

/**
 * Translate PDF locally using BabelDOC or custom API
 */
export async function translatePDFLocally(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
): Promise<void> {
  // Check if BabelDOC is preferred (default to true as it's the recommended method)
  const useBabelDOC = getPref("useBabelDOC") !== false; // Default to true

  if (useBabelDOC) {
    // Use BabelDOC CLI (recommended method)
    await translatePDFWithBabelDOC(taskData, parentItem);
    return;
  }

  // Fallback to text extraction + API translation (legacy method)
  await translatePDFWithTextExtraction(taskData, parentItem);
}

/**
 * Legacy method: Extract text and translate with custom API
 * This is kept as a fallback option if BabelDOC is not available
 */
async function translatePDFWithTextExtraction(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
): Promise<void> {
  // Lazy import to avoid loading issues if not needed
  const { translateText } = await import("./custom-translator");
  const { extractPDFTextByPages, chunkTextForTranslation } = await import("./pdf-processor");
  const attachmentId = taskData.attachmentId;
  const attachmentPath = taskData.attachmentPath;
  const attachmentFilename = taskData.attachmentFilename;
  const targetLanguage = taskData.targetLanguage;

  try {
    // Update status: Extracting text
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "extracting",
      progress: 10,
    });

    ztoolkit.log(`Extracting text from: ${attachmentFilename}`);

    // Extract text from PDF
    const pageTexts = await extractPDFTextByPages(attachmentPath);

    ztoolkit.log(`Extracted ${pageTexts.length} pages from PDF`);

    // Update status: Translating
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "translating",
      progress: 30,
    });

    // Translate page by page
    const translatedPages: string[] = [];
    const totalPages = pageTexts.length;

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i];

      ztoolkit.log(`Translating page ${i + 1}/${totalPages}`);

      // Skip empty pages
      if (!pageText || pageText.trim().length === 0) {
        translatedPages.push("");
        continue;
      }

      // Split page text into chunks if needed
      const chunks = chunkTextForTranslation(pageText, 3000);

      ztoolkit.log(
        `Page ${i + 1} split into ${chunks.length} chunk(s) for translation`,
      );

      // Translate chunks
      const translatedChunks: string[] = [];
      for (const chunk of chunks) {
        const translated = await translateText({
          text: chunk,
          targetLanguage: targetLanguage,
        });
        translatedChunks.push(translated);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Combine translated chunks back
      const translatedPage = translatedChunks.join("\n\n");
      translatedPages.push(translatedPage);

      // Update progress
      const progress = 30 + Math.floor((i + 1) / totalPages * 60);
      updateTaskInList(attachmentId, {
        status: "translating",
        stage: `translating (${i + 1}/${totalPages})`,
        progress: progress,
      });
    }

    // Update status: Generating output
    updateTaskInList(attachmentId, {
      status: "translating",
      stage: "generating",
      progress: 95,
    });

    ztoolkit.log("Translation completed, creating output file");

    // Create output file
    const resultAttachment = await createTranslatedOutput(
      taskData,
      pageTexts,
      translatedPages,
      parentItem,
    );

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
      // For text files, we'll open them in the default editor
      // Zotero.Reader.open only works for PDFs
      const filePath = resultAttachment.getFilePath();
      if (filePath && resultAttachment.attachmentContentType === "text/plain") {
        // Open in system default editor
        Zotero.launchFile(filePath);
      } else {
        Zotero.Reader.open(resultAttachment.id);
      }
    }
  } catch (error: any) {
    ztoolkit.log(`Local translation error for ${attachmentFilename}:`, error);
    updateTaskInList(attachmentId, {
      status: "failed",
      error: error.message || "Translation failed",
    });
    throw error;
  }
}

/**
 * Create translated output file
 * Creates a bilingual text file or markdown file with original and translated text
 */
async function createTranslatedOutput(
  taskData: TranslationTaskData,
  originalPages: string[],
  translatedPages: string[],
  parentItem?: Zotero.Item,
): Promise<Zotero.Item> {
  const translateMode = taskData.translateMode;
  const originalFilename = taskData.attachmentFilename;
  const baseName = originalFilename.replace(/\.pdf$/i, "");
  const targetLanguage = taskData.targetLanguage;

  let content = "";
  let fileName = "";

  // Generate content based on translation mode
  if (translateMode === "all" || translateMode === "dual") {
    // Bilingual mode
    fileName = `${baseName}_${targetLanguage}_bilingual.md`;
    content = generateBilingualContent(originalPages, translatedPages);
  } else {
    // Translation only mode
    fileName = `${baseName}_${targetLanguage}_translated.md`;
    content = generateTranslationOnlyContent(translatedPages);
  }

  // Write to temporary file
  const tempDir = PathUtils.tempDir || Zotero.getTempDirectory().path;
  const tempPath = PathUtils.join(tempDir, fileName);

  await IOUtils.writeUTF8(tempPath, content);

  ztoolkit.log(`Created output file at: ${tempPath}`);

  // Import as attachment
  const attachment = await Zotero.Attachments.importFromFile({
    file: tempPath,
    parentItemID: taskData.parentItemId || undefined,
    collections: taskData.parentItemId
      ? undefined
      : Zotero.Items.get(taskData.attachmentId).getCollections(),
    libraryID: parentItem?.libraryID,
    title: fileName,
    contentType: "text/markdown",
  });

  attachment.setTags(["BabelDOC_translated", "Local_Translation"]);
  await attachment.saveTx();

  ztoolkit.log(`Attachment created with ID: ${attachment.id}`);

  // Clean up temp file
  try {
    await IOUtils.remove(tempPath);
  } catch (error: any) {
    ztoolkit.log(`Warning: Failed to remove temp file: ${error.message}`);
  }

  return attachment;
}

/**
 * Generate bilingual markdown content
 */
function generateBilingualContent(
  originalPages: string[],
  translatedPages: string[],
): string {
  let content = "# Bilingual Translation\n\n";
  content +=
    "*Generated by Zotero Immersive Translate (Local Translation)*\n\n";
  content += "---\n\n";

  for (let i = 0; i < originalPages.length; i++) {
    content += `## Page ${i + 1}\n\n`;

    if (originalPages[i] && originalPages[i].trim()) {
      content += `### Original\n\n${originalPages[i]}\n\n`;
      content += `### Translation\n\n${translatedPages[i] || "*Translation not available*"}\n\n`;
    } else {
      content += `*Empty page*\n\n`;
    }

    content += "---\n\n";
  }

  return content;
}

/**
 * Generate translation-only markdown content
 */
function generateTranslationOnlyContent(translatedPages: string[]): string {
  let content = "# Translation\n\n";
  content +=
    "*Generated by Zotero Immersive Translate (Local Translation)*\n\n";
  content += "---\n\n";

  for (let i = 0; i < translatedPages.length; i++) {
    if (translatedPages[i] && translatedPages[i].trim()) {
      content += `## Page ${i + 1}\n\n`;
      content += `${translatedPages[i]}\n\n`;
      content += "---\n\n";
    }
  }

  return content;
}
