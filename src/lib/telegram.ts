import "server-only";

const API = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type InlineButton = { text: string; callback_data: string };

async function call(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`telegram ${method} ${res.status}`, await res.text());
  }
  return res.ok;
}

export function sendMessage(
  chatId: string | number,
  text: string,
  buttons?: InlineButton[][],
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons ?? [] },
  });
}

export function answerCallbackQuery(id: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

export function sendChatAction(
  chatId: string | number,
  action = "typing",
) {
  return call("sendChatAction", { chat_id: chatId, action });
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

/** Descarga un archivo de Telegram (foto de un comprobante, PDF…) como base64. */
export async function getTelegramFile(
  fileId: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const meta = await fetch(`${API()}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!meta.ok) return null;
  const j = (await meta.json()) as {
    ok: boolean;
    result?: { file_path?: string; file_size?: number };
  };
  const path = j.result?.file_path;
  if (!path) return null;
  if ((j.result?.file_size ?? 0) > 15_000_000) return null;

  const bin = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`,
  );
  if (!bin.ok) return null;
  const buf = Buffer.from(await bin.arrayBuffer());

  // La extensión del file_path de Telegram es confiable; el content-type del
  // file server suele venir "application/octet-stream", y con eso Gemini
  // ignora la imagen.
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const header = bin.headers.get("content-type")?.split(";")[0]?.trim();
  const mimeType =
    MIME_BY_EXT[ext] ||
    (header && /^(image\/[\w.+-]+|application\/pdf)$/.test(header) ? header : "") ||
    "image/jpeg";
  return { base64: buf.toString("base64"), mimeType };
}

type TgPhoto = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};
type TgDocument = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

/** Telegram update payload (solo lo que usamos). */
export type TgUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    caption?: string;
    photo?: TgPhoto[];
    document?: TgDocument;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};
