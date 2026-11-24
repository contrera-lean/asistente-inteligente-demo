import { branches, branchName, sample, formatPrice, readInventory, confirmReceipt } from './inventory.js'
import { prepareImages } from './media.js'

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  add: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8m-4-4h8"/>',
  boxes: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-12 5h6"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-3v10l-6-3"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18m-16 0 1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 6V3h6v3m-5 4v7m4-7v7"/>',
  wand: '<path d="m4 20 13-13 3 3L7 23ZM5 3v6M2 6h6m10-5v4m-2-2h4m-7 8 3 3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M7 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  compare: '<path d="m9 8-4 4 4 4m6-8 4 4-4 4"/>',
}

const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

const main = document.querySelector('#main')
const navigation = [...document.querySelectorAll('[data-nav]')]
const toast = document.querySelector('#notification')
const fileUrls = new Map()
let usedUrls
let toastTimer
let draft = newDraft()
let stage = 1
let busy = false
let error = ''
let catalog = []
let stock = []
let catalogError = ''
let catalogBranch = branches[0].id
let receipt
let shareText
let shareFiles = []

function newDraft() {
  return {
    id: Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join(''),
    branch: '', note: '', capture: null, example: false, images: [], items: [],
  }
}

function blankItem(image = draft.images[0]) {
  return {
    code: '', name: '', description: '', retail: '', wholesale: '', existing: '',
    imageChoice: image === draft.images[0] ? 'original' : 'enhanced', image,
    enhanced: draft.images[1], variants: [{ size: '', quantity: '' }],
  }
}

function availableCode(code) {
  const taken = new Set(catalog.map(product => product.code))
  if (!taken.has(code)) return code
  let suffix = 2
  while (taken.has(`${code}-${suffix}`)) suffix++
  return `${code}-${suffix}`
}

function sampleItems() {
  return [
    {
      ...sample.shirt, existing: sample.shirt.code, imageChoice: 'enhanced',
      enhanced: sample.shirt.image, variants: [{ size: 'M', quantity: '12' }],
    },
    {
      ...sample.pants, code: availableCode(sample.pants.code),
      existing: catalog.some(product => product.code === sample.pants.code) ? sample.pants.code : '',
      imageChoice: 'enhanced', enhanced: sample.pants.image, variants: [{ size: '40', quantity: '6' }],
    },
  ]
}

function source(image) {
  if (!(image instanceof Blob)) return escapeHtml(image)
  usedUrls.add(image)
  if (!fileUrls.has(image)) fileUrls.set(image, URL.createObjectURL(image))
  return fileUrls.get(image)
}

function heading(title, subtitle) {
  return `<header class="page-header"><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></header>`
}

function cardTitle(name, title) {
  return `<div class="card-title"><span class="title-icon">${icon(name)}</span><h2>${title}</h2></div>`
}

function steps() {
  return `<ol class="steps" aria-label="Progreso del ingreso">${['Captura', 'Revisión', 'Confirmación'].map((label, index) => {
    const position = index + 1
    const current = position === stage ? 'aria-current="step"' : ''
    const done = position < stage
    return `<li ${current} class="${done ? 'done' : ''}"><span class="step-number">${done ? icon('check') : position}</span>${label}</li>`
  }).join('')}</ol>`
}

function notice(message, isError = false) {
  return `<div class="notice ${isError ? 'error' : ''}" ${isError ? 'role="alert"' : ''}>${icon('info')}<p>${escapeHtml(message)}</p></div>`
}

function branchOptions(selected, placeholder = false) {
  return `${placeholder ? '<option value="">Elegí una sucursal</option>' : ''}${branches.map(branch =>
    `<option value="${branch.id}" ${selected === branch.id ? 'selected' : ''}>${branch.name}</option>`).join('')}`
}

function capturePage() {
  const capture = draft.capture
  const media = capture instanceof File && capture.type.startsWith('video/')
    ? `<video src="${source(capture)}" controls playsinline preload="metadata"></video>`
    : `<img src="${source(capture)}" alt="Captura de la mercadería">`
  return `
    ${heading('Ingreso de mercadería', 'Cargá las prendas que llegaron y actualizá el stock de tu sucursal.')}
    ${steps()}
    ${error ? notice(error, true) : ''}
    <div class="columns capture-columns">
      <aside aria-label="Ingreso de ejemplo">
        <section class="card example-card">
          <img src="${sample.image}" alt="Remera rosa y pantalón beige sobre una tela clara" width="1050" height="700">
          <div class="example-content">
            <h2>Probá con un ejemplo</h2>
            <p class="muted small">Usá una foto y una descripción de muestra para recorrer un ingreso completo.</p>
            <button type="button" class="button soft wide" data-action="example" ${busy ? 'disabled' : ''}>${icon('wand')} Usar ejemplo</button>
          </div>
        </section>
      </aside>
      <form id="capture-form" class="stack">
        <section class="card">
          ${cardTitle('camera', 'Foto o video')}
          ${capture
            ? `<div class="capture-preview">${media}</div>`
            : `<div class="drop-zone" id="drop-zone">
                <span class="title-icon">${icon('image')}</span>
                <strong>Agregá una foto o un video</strong>
                <p class="small muted">Mostrá las prendas que llegaron.</p>
              </div>`}
          <div class="capture-actions">
            <button type="button" class="button" data-action="camera" ${busy ? 'disabled' : ''}>${icon('camera')} Tomar foto</button>
            <button type="button" class="button" data-action="video" ${busy ? 'disabled' : ''}>${icon('video')} Grabar video</button>
            <button type="button" class="button" data-action="gallery" ${busy ? 'disabled' : ''}>${icon('image')} Galería</button>
          </div>
          <input type="file" id="camera" accept="image/*" capture="environment" hidden>
          <input type="file" id="video" accept="video/*" capture="environment" hidden>
          <input type="file" id="gallery" accept="image/*,video/*" hidden>
        </section>
        <section class="card">
          ${cardTitle('note', 'Datos del ingreso')}
          <div class="fields">
            <label class="field"><span>Sucursal</span><select data-draft="branch" required>${branchOptions(draft.branch, true)}</select></label>
            <label class="field"><span>Descripción <small class="muted">(opcional)</small></span>
              <textarea data-draft="note" maxlength="3000" aria-describedby="dictation" placeholder="Ej. Remeras rosas, 12 talle M, $12.500 minorista…">${escapeHtml(draft.note)}</textarea>
            </label>
            <p id="dictation" class="small muted">Podés escribir o dictar con el micrófono del teclado.</p>
          </div>
        </section>
        <div class="actions"><button class="button primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Preparando la captura…' : 'Continuar'} ${icon('arrow')}</button></div>
      </form>
    </div>`
}

function itemField(index, key, label, value, attributes = '') {
  return `<label class="field"><span>${label}</span><input data-item="${index}" data-key="${key}" value="${escapeHtml(value)}" ${attributes}></label>`
}

function priceInput(value) {
  return typeof value === 'number' ? String(value).replace('.', ',') : value
}

function comparisonValue(split) {
  return `${split} % captura original, ${100 - split} % imagen mejorada`
}

function photoComparison(item, index) {
  const garment = `prenda ${index + 1}`
  if (!item.enhanced) {
    return `<div class="product-photo">
      <img class="photo-original" src="${source(item.image)}" alt="Captura original de la ${garment}">
    </div>`
  }

  const split = item.comparisonSplit ?? 50
  return `<div class="product-photo">
    <div class="photo-comparison" style="--split: ${split}%">
      <img src="${source(item.enhanced)}" alt="">
      <img class="comparison-original" src="${source(draft.images[0])}" alt="">
      <span class="comparison-divider" aria-hidden="true"></span>
      <span class="comparison-handle" aria-hidden="true">${icon('compare')}</span>
      <div class="comparison-labels" aria-hidden="true"><span>Original</span><span>Mejorada</span></div>
      <input class="comparison-range" type="range" min="0" max="100" value="${split}"
        data-item="${index}" data-key="comparisonSplit"
        aria-label="Comparar imágenes de la ${garment}" aria-valuetext="${comparisonValue(split)}">
    </div>
    <fieldset class="photo-choice">
      <legend>Imagen para guardar</legend>
      ${[['original', 'Original'], ['enhanced', 'Mejorada']].map(([choice, label]) => `<label>
        <input type="radio" name="photo-${index}" value="${choice}" data-item="${index}" data-key="imageChoice"
          ${item.imageChoice === choice ? 'checked' : ''}>
        ${label}
      </label>`).join('')}
    </fieldset>
  </div>`
}

function reviewItem(item, index) {
  const product = catalog.find(entry => entry.code === item.existing)
  const info = product ?? item
  const readonly = product ? 'readonly' : ''
  return `<section class="card stack" data-card="${index}">
    <div class="review-heading">
      <div><h2>Prenda ${index + 1}</h2></div>
      <button type="button" class="button quiet danger square" data-action="remove-item" data-index="${index}" aria-label="Quitar prenda ${index + 1}">${icon('trash')}</button>
    </div>
    ${photoComparison(item, index)}
    <div class="fields">
      <label class="field"><span>Producto</span><select data-item="${index}" data-key="existing">
        <option value="">Producto nuevo</option>
        ${catalog.map(entry => `<option value="${escapeHtml(entry.code)}" ${entry.code === item.existing ? 'selected' : ''}>Reposición · ${escapeHtml(entry.name)} (${escapeHtml(entry.code)})</option>`).join('')}
      </select></label>
      <div class="field-pair">
        ${itemField(index, 'name', 'Nombre', info.name, `required maxlength="100" ${readonly}`)}
        ${itemField(index, 'code', 'Código', info.code, `required maxlength="40" ${readonly}`)}
      </div>
      <label class="field"><span>Descripción del catálogo</span><textarea data-item="${index}" data-key="description" required maxlength="500" ${readonly}>${escapeHtml(info.description)}</textarea></label>
      <div class="field-pair">
        ${itemField(index, 'retail', 'Minorista ($)', priceInput(info.retail), `required inputmode="decimal" maxlength="18" ${readonly}`)}
        ${itemField(index, 'wholesale', 'Mayorista ($)', priceInput(info.wholesale), `required inputmode="decimal" maxlength="18" ${readonly}`)}
      </div>
    </div>
    <div class="variant-section">
      <h3>Talles y cantidades</h3>
      <div class="variant-list">
        ${item.variants.map((variant, row) => `<div class="variant-row">
          ${['size', 'quantity'].map((key, column) => `<label class="field"><span>${column === 0 ? 'Talle' : 'Unidades'}</span>
            <input data-item="${index}" data-row="${row}" data-key="${key}" value="${escapeHtml(variant[key])}" required
              ${column === 0 ? 'placeholder="Ej. M o Único" maxlength="16"' : 'inputmode="numeric" pattern="[0-9]+" maxlength="15" placeholder="Ej. 12"'}>
          </label>`).join('')}
          <button type="button" class="button quiet danger square" data-action="remove-variant" data-index="${index}" data-row="${row}" aria-label="Quitar talle ${row + 1} de la prenda ${index + 1}">${icon('trash')}</button>
        </div>`).join('')}
      </div>
      <div><button type="button" class="button soft" data-action="add-variant" data-index="${index}">${icon('plus')} Agregar talle</button></div>
    </div>
  </section>`
}

function reviewPage() {
  return `
    ${heading('Revisá las prendas', `${branchName(draft.branch)} · Completá los datos antes de sumar el stock.`)}
    ${steps()}
    ${error ? notice(error, true) : ''}
    <div class="columns review-columns">
      <aside class="stack review-context" aria-label="Contexto del ingreso">
        ${notice(draft.example ? 'Las sugerencias de este ejemplo están simuladas. Podés editar las fichas antes de confirmar.' : 'Completá una ficha por prenda. Podés usar la captura o una versión con ajustes de luz y contraste.')}
        ${draft.note.trim() ? `<details class="card"><summary>Nota de ingreso</summary><p class="muted note-text">${escapeHtml(draft.note)}</p></details>` : ''}
      </aside>
      <form id="review-form" class="stack">
        <fieldset class="review-fields stack" ${busy ? 'disabled' : ''}>
          ${draft.items.map(reviewItem).join('')}
          <div><button class="button soft" type="button" data-action="add-item">${icon('plus')} Agregar prenda</button></div>
        </fieldset>
        <div class="actions">
          <button class="button" type="button" data-action="back" ${busy ? 'disabled' : ''}>Volver</button>
          <button class="button primary" type="submit" ${busy ? 'disabled' : ''}>${icon('check')} ${busy ? 'Guardando…' : 'Confirmar ingreso'}</button>
        </div>
      </form>
    </div>`
}

function shareOptions() {
  return `<dialog id="share-options" class="card share-options" aria-labelledby="share-options-title">
    <div class="stack">
      <h2 id="share-options-title">Compartir la novedad</h2>
      <a class="button primary" id="share-whatsapp" target="_blank" rel="noopener noreferrer">${icon('share')} Abrir WhatsApp con el texto</a>
      <div class="stack">
        <p class="muted small">Para Instagram, Facebook o TikTok, descargá las fotos y pegá el texto en la publicación.</p>
        <button type="button" class="button" data-action="copy">${icon('copy')} Copiar texto</button>
        <p class="small muted" role="status"></p>
        ${receipt.products.map((product, index) => `<a class="button" href="${source(product.image)}" download="prenda-${index + 1}.${photoExtension(product.image)}">
          ${icon('download')} Descargar foto de ${escapeHtml(product.name)}
        </a>`).join('')}
      </div>
      <form method="dialog"><button class="button quiet wide" type="submit">Cerrar</button></form>
    </div>
  </dialog>`
}

function successPage() {
  const count = receipt.products.length
  return `
    <header class="page-header">
      <div class="success-heading"><span class="title-icon">${icon('check')}</span><h1 tabindex="-1">Ingreso confirmado</h1></div>
      <p>Las unidades quedaron sumadas al stock de ${branchName(receipt.branch)}.</p>
    </header>
    ${steps()}
    <div class="columns">
      <section class="card stack">
        ${cardTitle('share', 'Compartí la novedad')}
        <div class="share-preview">${receipt.products.map(product => `<img src="${source(product.image)}" alt="${escapeHtml(product.name)}">`).join('')}</div>
        <label class="field"><span>Texto para compartir</span><textarea id="share-text" rows="5">${escapeHtml(shareText)}</textarea></label>
        <div class="actions share-actions">
          <button class="button" type="button" data-action="copy">${icon('copy')} Copiar texto</button>
          <button class="button primary" type="button" data-action="share">${icon('share')} Compartir</button>
        </div>
        ${shareOptions()}
      </section>
      <aside class="stack">
        <section class="card">
          ${cardTitle('boxes', 'Resumen del ingreso')}
          <div class="summary">
            <div><span>Sucursal</span><strong>${branchName(receipt.branch)}</strong></div>
            <div><span>Productos</span><strong>${count}</strong></div>
            <div><span>Unidades</span><strong>${receipt.units}</strong></div>
          </div>
        </section>
        <button class="button soft" type="button" data-action="reset">${icon('add')} Cargar otro ingreso</button>
      </aside>
    </div>`
}

function catalogPage() {
  return `
    ${heading('Catálogo', 'Consultá las prendas y el stock de cada sucursal.')}
    ${catalogError ? notice(catalogError, true) : ''}
    <label class="field catalog-branch"><span>Ver stock de</span><select id="catalog-branch">${branchOptions(catalogBranch)}</select></label>
    <div class="catalog-grid">
      ${catalog.map(product => {
        const lines = stock.filter(line => line.code === product.code && line.branch === catalogBranch)
        return `<article class="card">
          <img class="catalog-image" src="${source(product.image)}" alt="${escapeHtml(product.name)}">
          <h2>${escapeHtml(product.name)}</h2>
          <p class="muted small">${escapeHtml(product.code)} · ${escapeHtml(product.description)}</p>
          <p class="small">Minorista <strong>${formatPrice(product.retail)}</strong><br>Mayorista <strong>${formatPrice(product.wholesale)}</strong></p>
          <div class="stock-list">
            ${lines.length ? lines.map(line => `<div><span>Talle ${escapeHtml(line.size)}</span><strong>${line.quantity} u.</strong></div>`).join('')
              : '<p class="small muted">Sin unidades en esta sucursal.</p>'}
          </div>
        </article>`
      }).join('')}
      ${!catalog.length && !catalogError ? '<p class="muted">Cargando catálogo…</p>' : ''}
    </div>`
}

function render() {
  const onCatalog = location.hash === '#catalogo'
  for (const link of navigation) {
    if ((link.dataset.nav === 'catalogo') === onCatalog) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  usedUrls = new Set()
  main.innerHTML = onCatalog ? catalogPage() : [capturePage, reviewPage, successPage][stage - 1]()
  for (const [file, url] of fileUrls) {
    if (usedUrls.has(file)) continue
    URL.revokeObjectURL(url)
    fileUrls.delete(file)
  }
}

function showPage() {
  render()
  window.scrollTo(0, 0)
  main.querySelector('h1').focus({ preventScroll: true })
}

function showError(message) {
  error = message
  showPage()
}

function notify(message) {
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.hidden = false
  toastTimer = setTimeout(() => { toast.hidden = true }, 3400)
}

async function refreshCatalog() {
  try {
    const inventory = await readInventory()
    catalog = inventory.catalog
    stock = inventory.stock
    catalogError = ''
  } catch {
    catalogError = 'No pudimos abrir el catálogo en este navegador.'
  }
}

function loadExample() {
  setCapture(sample.image, true)
  draft.branch ||= 'centro'
  draft.note = sample.note
  render()
  main.querySelector('[data-draft="branch"]').focus()
}

function setCapture(capture, example = false) {
  draft.capture = capture
  draft.example = example
  draft.images = []
  draft.items = []
  error = ''
}

function useFile(file) {
  if (!file) return
  if (!/^(image|video)\//.test(file.type)) {
    showError('Elegí un archivo de foto o video.')
    return
  }
  setCapture(file)
  render()
}

function updateField(event) {
  const field = event.target
  const { draft: draftKey, item: index, row, key } = field.dataset
  if (draftKey) draft[draftKey] = field.value
  if (field.id === 'share-text') shareText = field.value
  if (index === undefined || !key) return
  if (key === 'existing' || key === 'imageChoice') return
  const item = draft.items[index]
  if (key === 'comparisonSplit') {
    const split = field.valueAsNumber
    item.comparisonSplit = split
    field.parentElement.style.setProperty('--split', `${split}%`)
    field.setAttribute('aria-valuetext', comparisonValue(split))
    return
  }
  const target = row === undefined ? item : item.variants[row]
  target[key] = field.value
}

function changeField(event) {
  const field = event.target
  const { item: index, key } = field.dataset
  if (field.type === 'file') useFile(field.files[0])
  if (field.id === 'catalog-branch') {
    catalogBranch = field.value
    render()
    document.querySelector('#catalog-branch').focus()
  }
  if (index === undefined || !['existing', 'imageChoice'].includes(key)) return
  const item = draft.items[index]
  item[key] = field.value
  if (key === 'imageChoice') {
    item.image = field.value === 'enhanced' ? item.enhanced : draft.images[0]
    return
  }
  render()
  main.querySelector(`[data-item="${index}"][data-key="${key}"]`).focus()
}

async function continueToReview() {
  if (!draft.capture) {
    showError('Agregá una foto o un video, o usá el ejemplo para continuar.')
    return
  }
  busy = true
  error = ''
  render()
  try {
    await refreshCatalog()
    if (catalogError) throw new Error(catalogError)
    if (!draft.images.length) {
      draft.images = draft.example ? [sample.image] : await prepareImages(draft.capture)
      draft.items = draft.example ? sampleItems() : [blankItem(draft.images[1])]
    }
    stage = 2
  } catch (failure) {
    error = failure.message
  } finally {
    busy = false
    showPage()
  }
}

function photoExtension(image) {
  return (image instanceof Blob ? image.type === 'image/webp' : image.endsWith('.webp')) ? 'webp' : 'jpg'
}

async function prepareShareFiles(result) {
  try {
    const files = await Promise.all(result.products.map(async (product, index) => {
      let blob = product.image
      if (!(blob instanceof Blob)) {
        const response = await fetch(blob)
        if (!response.ok) throw new Error('No se pudo abrir la imagen.')
        blob = await response.blob()
      }
      return new File([blob], `prenda-${index + 1}.${photoExtension(blob)}`, { type: blob.type })
    }))
    if (result === receipt) shareFiles = files
  } catch {
    if (result === receipt) shareFiles = []
  }
}

async function finishReceipt() {
  busy = true
  error = ''
  render()
  try {
    receipt = await confirmReceipt(draft)
    catalogBranch = receipt.branch
    shareText = `¡Llegaron novedades a Bueno Bonito Barato!\n\n${receipt.products.map(product =>
      `• ${product.name} · ${formatPrice(product.retail)}`).join('\n')}\n\nConsultanos por los talles disponibles en ${branchName(receipt.branch)}.`
    shareFiles = []
    if (navigator.canShare) void prepareShareFiles(receipt)
    stage = 3
  } catch (failure) {
    error = failure instanceof DOMException ? 'No pudimos guardar el ingreso. Volvé a intentar.' : failure.message
  } finally {
    busy = false
    showPage()
  }
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(shareText)
    const status = main.querySelector('#share-options[open] [role="status"]')
    if (status) status.textContent = 'Texto copiado.'
    else notify('Texto copiado.')
  } catch {
    const field = document.querySelector('#share-text')
    if (!field) return
    document.querySelector('#share-options[open]')?.close()
    field.focus()
    field.select()
    notify('Mantené presionado el texto seleccionado para copiarlo.')
  }
}

function openShareOptions() {
  const dialog = document.querySelector('#share-options')
  if (!dialog || dialog.open) return
  const query = new URLSearchParams({ text: shareText })
  dialog.querySelector('#share-whatsapp').href = `https://wa.me/?${query}`
  dialog.querySelector('[role="status"]').textContent = ''
  dialog.showModal()
}

async function sharePromotion() {
  if (!navigator.share || !shareFiles.length || !navigator.canShare?.({ files: shareFiles })) {
    openShareOptions()
    return
  }
  try {
    await navigator.share({ text: shareText, files: shareFiles })
  } catch (failure) {
    if (failure.name !== 'AbortError') openShareOptions()
  }
}

function editItems(action, index, row) {
  const item = draft.items[index]
  if (action === 'add-item') draft.items.push(blankItem())
  if (action === 'remove-item') draft.items.splice(index, 1)
  if (action === 'add-variant') item.variants.push({ size: '', quantity: '' })
  if (action === 'remove-variant') item.variants.splice(row, 1)
  error = ''
  render()
  if (action === 'add-item') {
    main.querySelector(`[data-item="${draft.items.length - 1}"][data-key="name"]`).focus()
  } else if (action === 'add-variant') {
    main.querySelector(`[data-item="${index}"][data-row="${item.variants.length - 1}"][data-key="size"]`).focus()
  } else {
    const next = action === 'remove-item'
      ? main.querySelector('[data-action="add-item"]')
      : main.querySelector(`[data-index="${index}"][data-action="add-variant"]`)
    next?.focus()
  }
}

function resetIngreso() {
  draft = newDraft()
  receipt = undefined
  shareFiles = []
  stage = 1
  error = ''
}

main.addEventListener('input', updateField)
main.addEventListener('change', changeField)
main.addEventListener('submit', event => {
  if (event.target.method === 'dialog') return
  event.preventDefault()
  if (busy) return
  if (event.target.id === 'capture-form') void continueToReview()
  if (event.target.id === 'review-form') void finishReceipt()
})

main.addEventListener('click', event => {
  const button = event.target.closest('[data-action]')
  if (!button || busy) return
  const { action, index, row } = button.dataset
  if (['camera', 'video', 'gallery'].includes(action)) document.getElementById(action).click()
  if (action === 'example') loadExample()
  if (action === 'back') {
    stage = 1
    error = ''
    showPage()
  }
  if (action === 'reset') {
    resetIngreso()
    showPage()
  }
  if (['add-item', 'remove-item', 'add-variant', 'remove-variant'].includes(action)) editItems(action, index, row)
  if (action === 'copy') void copyText()
  if (action === 'share') void sharePromotion()
})

main.addEventListener('dragover', event => {
  if (event.target.closest('#drop-zone')) event.preventDefault()
})
main.addEventListener('drop', event => {
  if (!event.target.closest('#drop-zone')) return
  event.preventDefault()
  if (!busy) useFile(event.dataTransfer.files[0])
})

async function navigate() {
  showPage()
  if (location.hash === '#catalogo') {
    await refreshCatalog()
    if (location.hash === '#catalogo') render()
  }
}

navigation[0].innerHTML = `${icon('add')} Nuevo ingreso`
navigation[1].innerHTML = `${icon('boxes')} Catálogo`
navigation[0].addEventListener('click', event => {
  if (stage !== 3) return
  resetIngreso()
  if (location.hash === '#ingreso') {
    event.preventDefault()
    showPage()
  }
})
window.addEventListener('hashchange', navigate)
if (location.hash === '#catalogo') void navigate()
else render()
if ('serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js').catch(console.warn)
