function makePhoto(source, enhanced) {
  const width = source.videoWidth || source.naturalWidth
  const height = source.videoHeight || source.naturalHeight
  const scale = Math.min(1, 1200 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (enhanced) context.filter = 'brightness(1.07) contrast(1.08) saturate(1.03)'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')), 'image/jpeg', 0.88)
  })
}

export async function prepareImages(file) {
  const url = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video/')
  const source = isVideo ? document.createElement('video') : new Image()
  const loaded = new Promise((resolve, reject) => {
    source.addEventListener(isVideo ? 'loadeddata' : 'load', resolve, { once: true })
    source.addEventListener('error', reject, { once: true })
  })
  source.preload = 'auto'
  source.muted = true
  source.src = url
  let timeout
  try {
    await Promise.race([
      loaded,
      new Promise((_, reject) => { timeout = setTimeout(reject, 12000) }),
    ])
    return await Promise.all([makePhoto(source, false), makePhoto(source, true)])
  } catch {
    throw new Error('No pudimos abrir esa captura. Probá con otra foto o video.')
  } finally {
    clearTimeout(timeout)
    source.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}
