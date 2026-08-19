import * as mammoth from "mammoth";
import JSZip from "jszip";

/**
 * Extract text from a DOCX file using mammoth.
 * Returns an array of strings, simulating pages (we'll just use one big chunk or split by some heuristic if needed,
 * but for simplicity, we return an array of paragraphs or one single string wrapped in an array).
 */
export async function extractDocx(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  // mammoth expects a buffer in Node, but works with ArrayBuffer in browser
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value || "";
  
  // To simulate "pages" for chunking, we can split by double newlines or just return it as one big page
  // The chunker will handle splitting long strings anyway.
  return [text];
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

  return [textNodes.join("\n\n")];
}

/**
 * Extract text from a plain text or markdown file.
 */
export async function extractText(file: File): Promise<string[]> {
  const text = await file.text();
  return [text];
}
