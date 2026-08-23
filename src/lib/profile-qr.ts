/** Browser-only — generates a profile QR PNG. */
export async function renderProfileQrCanvas(
  url: string,
  size = 320,
): Promise<HTMLCanvasElement> {
  const mod = await import("qrcode");
  const QRCode = mod.default ?? mod;
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: "#1c2420", light: "#ffffff" },
  });
  return canvas;
}

export async function profileQrPngBlob(
  url: string,
  size = 512,
): Promise<Blob> {
  const canvas = await renderProfileQrCanvas(url, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export QR"))),
      "image/png",
    );
  });
}

export function profileQrDownloadName(slug: string): string {
  const safe = slug.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `toucan-profile-${safe || "link"}.png`;
}
