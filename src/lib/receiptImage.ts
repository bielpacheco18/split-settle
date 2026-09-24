// Prepara o arquivo do comprovante para o modelo de visão, que só aceita imagem.
// PDFs (boletos, notas em PDF) e fotos HEIC/HEIF (padrão do iPhone) são convertidos para JPEG.

// Boletos e notas fiscais têm texto pequeno e denso (linha digitável, tabelas de valores);
// uma resolução baixa faz a IA confundir dígitos de código de barras com o valor a pagar.
const MAX_DIMENSION = 2200;

export interface PreparedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas não suportado neste navegador."));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((m) => m.default),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const scale = Math.min(3, MAX_DIMENSION / Math.max(page.getViewport({ scale: 1 }).width, 1));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste navegador.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function convertHeic(file: File): Promise<string> {
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return fileToDataUrl(blob);
}

/** Converte o arquivo escolhido (imagem, HEIC/HEIF ou PDF) para um JPEG em base64. */
export async function prepareReceiptImage(file: File): Promise<PreparedImage> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isHeic = /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);

  let dataUrl: string;
  if (isPdf) {
    dataUrl = await renderPdfFirstPage(file);
  } else if (isHeic) {
    dataUrl = await dataUrlToJpeg(await convertHeic(file));
  } else if (file.type.startsWith("image/")) {
    dataUrl = await dataUrlToJpeg(await fileToDataUrl(file));
  } else {
    throw new Error("Formato não suportado. Envie uma foto ou um PDF do comprovante.");
  }

  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg", previewUrl: dataUrl };
}
