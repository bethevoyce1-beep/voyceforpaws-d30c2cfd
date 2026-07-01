// Minimal, dependency-free EXIF reader for uploaded JPEG photos.
//
// Extracts the photo's ORIGINAL capture time and GPS coordinates when they are
// present in the file. This lets an uploaded "photo from before" report where
// and when the animal was actually seen, instead of the reporter's current
// location/time.
//
// IMPORTANT: everything here is wrapped so any parsing failure returns nulls
// (it never throws). Callers fall back to the current time/location. Note that
// many browsers — especially iOS Safari — strip GPS out of photos chosen via a
// web file picker for privacy, so GPS is best-effort. Live "Take a Photo" is
// always the most reliable source of location.

export type PhotoMeta = {
  takenAt: number | null; // epoch milliseconds when the photo was captured
  lat: number | null;
  lon: number | null;
};

const EMPTY: PhotoMeta = { takenAt: null, lat: null, lon: null };

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    if (!file) return EMPTY;
    const buf = await file.arrayBuffer();
    return parseJpegExif(new DataView(buf));
  } catch {
    return EMPTY;
  }
}

function parseJpegExif(view: DataView): PhotoMeta {
  try {
    // JPEG files start with the SOI marker 0xFFD8.
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffe1) {
        // APP1 segment. After the 2-byte length comes "Exif\0\0" then TIFF data.
        const app1 = offset + 4;
        if (app1 + 6 <= view.byteLength && view.getUint32(app1) === 0x45786966) {
          return parseTiff(view, app1 + 6);
        }
        return EMPTY;
      }
      const size = view.getUint16(offset + 2);
      if (size < 2) break;
      offset += 2 + size;
    }
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

function parseTiff(view: DataView, tiff: number): PhotoMeta {
  try {
    const byteOrder = view.getUint16(tiff);
    const le = byteOrder === 0x4949; // "II" = little-endian; "MM" (0x4D4D) = big-endian
    if (!le && byteOrder !== 0x4d4d) return EMPTY;

    const u16 = (o: number) => view.getUint16(o, le);
    const u32 = (o: number) => view.getUint32(o, le);
    if (u16(tiff + 2) !== 0x002a) return EMPTY;

    const readEntries = (ifd: number): Map<number, number> => {
      const m = new Map<number, number>();
      if (ifd + 2 > view.byteLength) return m;
      const count = u16(ifd);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        m.set(u16(e), e);
      }
      return m;
    };
    const type = (e: number) => u16(e + 2);
    const count = (e: number) => u32(e + 4);
    const valOff = (e: number) => e + 8;

    const readAscii = (e: number): string => {
      const n = count(e);
      const start = n <= 4 ? valOff(e) : tiff + u32(valOff(e));
      let s = "";
      for (let i = 0; i < n; i++) {
        if (start + i >= view.byteLength) break;
        const c = view.getUint8(start + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    };
    const readRationals = (e: number, n: number): number[] => {
      const start = tiff + u32(valOff(e)); // rationals (8 bytes each) are always referenced by offset
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const num = u32(start + i * 8);
        const den = u32(start + i * 8 + 4);
        out.push(den === 0 ? 0 : num / den);
      }
      return out;
    };

    const ifd0 = readEntries(tiff + u32(tiff + 4));

    // ---- Original capture date/time ----
    let dateStr = "";
    const exifPtr = ifd0.get(0x8769); // Exif sub-IFD pointer
    if (exifPtr) {
      const exif = readEntries(tiff + u32(valOff(exifPtr)));
      const dto = exif.get(0x9003) ?? exif.get(0x9004); // DateTimeOriginal / DateTimeDigitized
      if (dto && type(dto) === 2) dateStr = readAscii(dto);
    }
    if (!dateStr) {
      const dt = ifd0.get(0x0132); // DateTime (fallback)
      if (dt && type(dt) === 2) dateStr = readAscii(dt);
    }
    const takenAt = parseExifDate(dateStr);

    // ---- GPS coordinates ----
    let lat: number | null = null;
    let lon: number | null = null;
    const gpsPtr = ifd0.get(0x8825);
    if (gpsPtr) {
      const gps = readEntries(tiff + u32(valOff(gpsPtr)));
      const latE = gps.get(0x0002);
      const lonE = gps.get(0x0004);
      const latRefE = gps.get(0x0001);
      const lonRefE = gps.get(0x0003);
      if (latE && lonE && count(latE) >= 3 && count(lonE) >= 3) {
        const [d1, m1, s1] = readRationals(latE, 3);
        const [d2, m2, s2] = readRationals(lonE, 3);
        let la = d1 + m1 / 60 + s1 / 3600;
        let lo = d2 + m2 / 60 + s2 / 3600;
        const latRef = latRefE ? readAscii(latRefE).toUpperCase() : "N";
        const lonRef = lonRefE ? readAscii(lonRefE).toUpperCase() : "E";
        if (latRef === "S") la = -la;
        if (lonRef === "W") lo = -lo;
        // Validate before trusting — a bad parse must never send rescuers astray.
        if (
          Number.isFinite(la) &&
          Number.isFinite(lo) &&
          Math.abs(la) <= 90 &&
          Math.abs(lo) <= 180 &&
          !(la === 0 && lo === 0)
        ) {
          lat = la;
          lon = lo;
        }
      }
    }

    return { takenAt, lat, lon };
  } catch {
    return EMPTY;
  }
}

function parseExifDate(s: string): number | null {
  // EXIF date format: "YYYY:MM:DD HH:MM:SS" (colons in the date part).
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec((s || "").trim());
  if (!m) return null;
  const t = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime();
  if (!Number.isFinite(t)) return null;
  // Sanity: reject absurd dates (before 2000 or in the future).
  const now = Date.now();
  if (t < 946684800000 || t > now + 86400000) return null;
  return t;
}
