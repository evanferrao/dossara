import * as mammoth from "mammoth";
import JSZip from "jszip";

/** Approximate characters per simulated document page (≈ 500-600 words) */
export const CHARS_PER_SIMULATED_PAGE = 2500;

/**
 * Split continuous text into logical "pages" based on paragraph boundaries.
 * Preserves paragraphs where possible, ensuring non-PDF documents (DOCX, ODT, TXT, MD)
 * have realistic page counts for batch processing and accurate citation references.
 */
export function splitTextIntoPages(
  text: string,
  charsPerPage: number = CHARS_PER_SIMULATED_PAGE
): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= charsPerPage) {
    return [trimmed];
  }

  const paragraphs = trimmed.split(/\n{2,}/);
  const pages: string[] = [];
  let currentPage: string[] = [];
  let currentLen = 0;

  for (const para of paragraphs) {
    const paraTrimmed = para.trim();
    if (!paraTrimmed) continue;

    if (currentLen > 0 && currentLen + paraTrimmed.length > charsPerPage) {
      pages.push(currentPage.join("\n\n"));
      currentPage = [paraTrimmed];
      currentLen = paraTrimmed.length;
    } else {
      currentPage.push(paraTrimmed);
      currentLen += paraTrimmed.length + 2;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n\n"));
  }

  return pages.length > 0 ? pages : [trimmed];
}

/**
 * Extract text from a DOCX file using mammoth.
 * Returns an array of simulated pages split along paragraph boundaries.
 */
export async function extractDocx(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  // mammoth expects a buffer in Node, but works with ArrayBuffer in browser
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value || "";
  
  return splitTextIntoPages(text);
}

/**
 * Extract text from an ODT file by parsing the internal content.xml.
 */
export async function extractOdt(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const contentXml = zip.file("content.xml");
  if (!contentXml) {
    throw new Error("Invalid ODT file: missing content.xml");
  }

  const xmlString = await contentXml.async("text");
  
  // Use browser DOMParser to parse the XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  // Extract all text nodes
  // ODT text paragraphs are usually under <text:p> or <text:h>
  const textNodes = Array.from(xmlDoc.getElementsByTagName("*"))
    .filter(node => node.nodeName.startsWith("text:p") || node.nodeName.startsWith("text:h"))
    .map(node => node.textContent?.trim() || "")
    .filter(text => text.length > 0);

  return splitTextIntoPages(textNodes.join("\n\n"));
}

/**
 * Extract text from a plain text or markdown file.
 */
export async function extractText(file: File): Promise<string[]> {
  const text = await file.text();
  return splitTextIntoPages(text);
}
