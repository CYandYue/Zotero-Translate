/**
 * PDF Text Extraction and Processing
 * Uses pdfjs-dist to extract text from PDFs
 */

export interface PDFTextContent {
  pageNumber: number;
  text: string;
  items: any[];
}

export interface PDFDocumentInfo {
  numPages: number;
  pages: PDFTextContent[];
}

/**
 * Extract text from a PDF file using pdfjs-dist
 */
export async function extractPDFText(
  filePath: string,
): Promise<PDFDocumentInfo> {
  try {
    ztoolkit.log(`Extracting text from PDF: ${filePath}`);

    // Dynamically import pdfjs-dist to avoid loading issues
    const pdfjsLib = await import("pdfjs-dist");

    // Read PDF file as ArrayBuffer
    const fileData = await IOUtils.read(filePath);
    const arrayBuffer = fileData.buffer;

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/standard_fonts/",
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    ztoolkit.log(`PDF has ${numPages} pages`);

    const pages: PDFTextContent[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine all text items into a single string
      const pageText = textContent.items
        .map((item: any) => {
          if ("str" in item) {
            return item.str;
          }
          return "";
        })
        .join(" ");

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        items: textContent.items,
      });

      ztoolkit.log(`Extracted page ${pageNum}/${numPages}`);
    }

    ztoolkit.log(`Successfully extracted ${pages.length} pages`);

    return {
      numPages: pages.length,
      pages,
    };
  } catch (error: any) {
    ztoolkit.log("PDF extraction error:", error);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }
}

/**
 * Group text into chunks suitable for translation
 * Splits by paragraphs or size limits
 */
export function chunkTextForTranslation(
  text: string,
  maxChunkSize: number = 3000,
): string[] {
  const chunks: string[] = [];

  // Split by double newlines (paragraphs) first
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();

    if (!trimmedParagraph) continue;

    // If adding this paragraph exceeds max size, save current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + trimmedParagraph.length + 2 > maxChunkSize
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // If a single paragraph is too large, split it by sentences
    if (trimmedParagraph.length > maxChunkSize) {
      const sentences = trimmedParagraph.split(/[.!?]+\s+/);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 2 > maxChunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? " " : "") + sentence;
        }
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmedParagraph;
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Extract text by pages for page-by-page translation
 */
export async function extractPDFTextByPages(
  filePath: string,
): Promise<string[]> {
  const pdfInfo = await extractPDFText(filePath);
  return pdfInfo.pages.map((page) => page.text);
}
