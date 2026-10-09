// Client-side downscale/re-encode so a phone-camera photo (often 8-15MB)
// never hits a hard upload-size wall — shrinks to a sane max dimension and
// re-encodes as JPEG, which for a photo is virtually always well under 1MB.
// Falls back to the original file if the browser can't produce a blob.
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
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Wrap the blob back into a File with a .jpg name: the upload paths build the
// storage key from file.name, and a Blob has none.
export function asJpegFile(original, blob) {
  if (!blob || blob === original) return original;
  const base = (original.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

// THE preset for every car-photo upload (CarForm, CarFormFast, AddCarForm,
// NewCarForm). Two of those uploaded the raw camera file, which is why 29
// car-images objects were over 1MB (max 3.9MB): the image proxy has to pull
// the whole original before it can resize it, and the onError fallback shows
// buyers that original. 1200px on the long side is what the pages ever ask for.
export async function compressListingPhoto(file) {
  return asJpegFile(file, await compressImageFile(file, { maxDim: 1200, quality: 0.82 }));
}
