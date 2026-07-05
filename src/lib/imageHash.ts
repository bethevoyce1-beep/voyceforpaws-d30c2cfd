// Anti-scam Tier 2 (July 5, 2026): perceptual hash (dHash) of a photo,
// computed in the browser. The same image — even re-compressed — produces the
// same 64-bit hash, so a photo resubmitted within 30 days can be rejected
// server-side. A different photo of the same animal hashes differently, so
// honest re-checks ("Recheck" flow, new photo at the scene) always pass.
//
// Algorithm: scale to 9×8 grayscale, compare each pixel to its right
// neighbor → 64 bits → 16-char hex string.

export async function dhashFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 9, 8);
    const { data } = ctx.getImageData(0, 0, 9, 8);

    // Luminance per pixel (Rec. 601 weights).
    const lum: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      lum.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 8 comparisons per row × 8 rows = 64 bits.
    let hash = "";
    let nibble = 0;
    let bits = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = lum[y * 9 + x];
        const right = lum[y * 9 + x + 1];
        nibble = (nibble << 1) | (left > right ? 1 : 0);
        bits++;
        if (bits === 4) {
          hash += nibble.toString(16);
          nibble = 0;
          bits = 0;
        }
      }
    }
    return hash; // 16 hex chars = 64 bits
  } catch {
    // Hashing is best-effort — never block a rescue report over it.
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
