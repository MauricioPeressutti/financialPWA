import "server-only";

/** Texto de un PDF (capa de texto). Vacío si es un PDF escaneado / solo imágenes. */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    const out = (Array.isArray(text) ? text.join("\n") : text).trim();
    console.log("[pdf] ok:", out.length, "chars");
    return out;
  } catch (err) {
    console.error(
      "[pdf] extract FAILED:",
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    return "";
  }
}
