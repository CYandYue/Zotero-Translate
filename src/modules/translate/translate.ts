import type { TranslationTaskData } from "../../types";
import { translatePDFLocally } from "../../api/local-translator";

export async function translatePDF(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
): Promise<void> {
  ztoolkit.log(
    `Using local translation for: ${taskData.attachmentFilename}`,
  );
  await translatePDFLocally(taskData, parentItem);
}
