// Client-side downscale/re-encode so a phone-camera photo (often 8-15MB)
// never hits a hard upload-size wall — shrinks to a sane max dimension and
// re-encodes as JPEG, which for a photo is virtually always well under 1MB.
// Falls back to the original file if the browser can't produce a blob.
//
// TRANSPARENT photos (a cut-out car, PNG/WebP with see-through pixels) are NOT
// turned into JPEG: JPEG has no transparency, so a canvas re-encode paints every
// see-through pixel BLACK. They are re-encoded as WebP (keeps transparency,
// small), or PNG where the browser cannot write WebP (older Safari).
export async function compressImageFile(file, { maxDim = 1600, quality = 0.82 } = {}) {
  if (!file.type.startsWith('image/')) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    if (canMaybeBeTransparent(file) && hasTransparency(ctx, width, height)) {
      const webp = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      // A browser that cannot encode WebP hands back a PNG instead; ask for PNG
      // outright so the type is never a surprise.
      if (webp && webp.type === 'image/webp') return webp;
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      return png || file;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Only these formats can carry see-through pixels. A camera photo (JPEG/HEIC)
// skips the pixel scan entirely.
const ALPHA_TYPES = new Set(['image/png', 'image/webp', 'image/gif', 'image/avif']);
function canMaybeBeTransparent(file) {
  return ALPHA_TYPES.has(file.type);
}

// True when any pixel is not fully opaque. A PNG screenshot is opaque and
// still goes to JPEG (far smaller); only a real cut-out keeps its transparency.
function hasTransparency(ctx, width, height) {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// File extension for an encoded photo, for storage paths that name the file
// themselves (NewCarForm, the console's new-car photos).
export function photoExt(file) {
  const type = file?.type || '';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

// Wrap the blob back into a File named for what it now is (.jpg, or .webp /
// .png for a transparent photo): the upload paths build the storage key from
// file.name and the content type from file.type, and a Blob has no name.
export function asJpegFile(original, blob) {
  if (!blob || blob === original) return original;
  const base = (original.name || 'photo').replace(/\.[^.]+$/, '');
  const type = blob.type || 'image/jpeg';
  return new File([blob], `${base}.${photoExt({ type })}`, { type });
}

// THE preset for every car-photo upload (CarForm, AddCarForm,
// NewCarForm). Two of those uploaded the raw camera file, which is why 29
// car-images objects were over 1MB (max 3.9MB): the image proxy has to pull
// the whole original before it can resize it, and the onError fallback shows
// buyers that original. 1200px on the long side is what the pages ever ask for.
export async function compressListingPhoto(file) {
  return asJpegFile(file, await compressImageFile(file, { maxDim: 1200, quality: 0.82 }));
}
