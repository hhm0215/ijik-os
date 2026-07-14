import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

export type ExtractedDocument = {
  name: string;
  text: string;
};

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: 파일은 10MB 이하여야 합니다.`);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`${file.name}: PDF, DOCX, TXT, MD 파일만 지원합니다.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  let text = "";

  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } else if (extension === "docx") {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(arrayBuffer),
    });
    text = result.value;
  } else {
    text = new TextDecoder("utf-8").decode(arrayBuffer);
  }

  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length < 30) {
    throw new Error(`${file.name}: 추출할 수 있는 텍스트가 너무 적습니다.`);
  }

  return { name: file.name, text: normalized };
}
