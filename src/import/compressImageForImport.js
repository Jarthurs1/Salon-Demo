/**
 * Compress / resize a photo for vision import (iPhone-friendly, lower token cost).
 * Photos are never uploaded to durable storage — only sent for one-shot extraction.
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.72
const MAX_BYTES = 3.5 * 1024 * 1024

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that photo.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not compress that photo.'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ blob: Blob, dataUrl: string, mimeType: string, width: number, height: number }>}
 */
export async function compressImageForImport(file) {
  if (!file) throw new Error('Choose a photo first.')
  const type = String(file.type || '')
  if (!type.startsWith('image/')) {
    throw new Error('Please choose a photo (JPG or PNG).')
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare that photo.')
  ctx.drawImage(img, 0, 0, width, height)

  let quality = JPEG_QUALITY
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }

  if (blob.size > MAX_BYTES) {
    throw new Error('That photo is still too large after compression. Try a clearer close-up.')
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the compressed photo.'))
    reader.readAsDataURL(blob)
  })

  return {
    blob,
    dataUrl,
    mimeType: 'image/jpeg',
    width,
    height,
  }
}

export function dataUrlToBase64(dataUrl) {
  const parts = String(dataUrl || '').split(',')
  if (parts.length < 2) return ''
  return parts[1]
}
