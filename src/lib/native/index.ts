import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** A light tick for taps that change the page. */
export async function haptic(kind: 'light' | 'medium' = 'light') {
  if (isNative) {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
  } else {
    navigator.vibrate?.(kind === 'light' ? 8 : 15);
  }
}

/**
 * Take a photo with the camera app. The web file input can't force the camera inside the Android
 * WebView (it opens the gallery), so the app uses the camera plugin. Null when cancelled.
 */
export async function takePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 92,
      correctOrientation: true,
      saveToGallery: false
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    return new File([blob], `photo.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
  } catch (e) {
    if (/cancel/i.test((e as Error).message)) return null;
    throw e;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Write a file to the app cache and open the Android share sheet (save to files, Drive, send…). */
export async function shareNative(filename: string, bytes: Uint8Array): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const written = await Filesystem.writeFile({ path: filename, data: toBase64(bytes), directory: Directory.Cache });
  await Share.share({ title: filename, files: [written.uri] }).catch((e: Error) => {
    // Closing the share sheet is not an error
    if (!/cancel/i.test(e.message)) throw e;
  });
}

/**
 * Android back button: close an open sheet first, then go back, then leave the app.
 * Sheets are bits-ui dialogs, which close on Escape.
 */
export async function initNative() {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    const open = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
    if (open) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } else if (location.pathname.replace(/\/$/, '').split('/').filter(Boolean).length > 0) {
      history.back();
    } else {
      App.exitApp();
    }
  });
}
