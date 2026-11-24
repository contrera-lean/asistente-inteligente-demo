export const branches = [
  { id: 'centro', name: 'Sucursal Centro' },
  { id: 'norte', name: 'Sucursal Norte' },
  { id: 'sur', name: 'Sucursal Sur' },
]

export const branchName = id => branches.find(branch => branch.id === id)?.name

export const sample = {
  image: './assets/ejemplo.webp',
  note: 'Remera rosa, 12 talle M, minorista $12.500 y mayorista $9.500. Pantalón beige, 6 talle 40, minorista $24.000 y mayorista $18.000.',
  shirt: {
    code: 'REM-001', name: 'Remera rosa', description: 'Remera de algodón rosa, de manga corta.',
    retail: 12500, wholesale: 9500, image: './assets/remera.webp',
  },
  pants: {
    code: 'PAN-001', name: 'Pantalón beige', description: 'Pantalón de gabardina beige.',
    retail: 24000, wholesale: 18000, image: './assets/pantalon.webp',
  },
}

function seed() {
  return {
    catalog: [sample.shirt],
    stock: [{ code: sample.shirt.code, branch: 'centro', size: 'M', quantity: 5 }],
    receipts: [],
  }
}

let database
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('bbb-ingresos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('demo')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(error => {
    database = undefined
    throw error
  })
  return database
}

export async function readInventory() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('demo').objectStore('demo').get('inventory')
    request.onsuccess = () => resolve(request.result ?? seed())
    request.onerror = () => reject(request.error)
  })
}

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 2, minimumFractionDigits: 0,
})

export const formatPrice = value => money.format(value)

function readPrice(value) {
  const text = String(value).trim()
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return NaN
  return Number(text.replaceAll('.', '').replace(',', '.'))
}

export function applyReceipt(inventory, draft) {
  const previous = inventory.receipts.find(receipt => receipt.id === draft.id)
  if (previous) return previous
  if (!branchName(draft.branch)) throw new Error('Elegí la sucursal que recibió las prendas.')
  if (!draft.items.length) throw new Error('Agregá al menos una prenda para confirmar el ingreso.')

  const products = new Map()
  const lines = []
  let units = 0
  for (const [index, item] of draft.items.entries()) {
    const label = `Prenda ${index + 1}`
    let product = inventory.catalog.find(entry => entry.code === item.existing)
    if (item.existing && !product) throw new Error(`${label}. Elegí un producto del catálogo.`)
    if (!product) {
      const code = item.code.trim().toUpperCase()
      const name = item.name.trim()
      const description = item.description.trim()
      const retail = readPrice(item.retail)
      const wholesale = readPrice(item.wholesale)
      if (!code || !name || !description) throw new Error(`${label}. Completá el nombre, el código y la descripción.`)
      if (inventory.catalog.some(entry => entry.code === code)) {
        throw new Error(`El código ${code} ya existe. Elegí una reposición o usá otro código.`)
      }
      if (!Number.isFinite(retail) || retail <= 0 || !Number.isFinite(wholesale) || wholesale <= 0) {
        throw new Error(`${label}. Cargá los dos precios con valores mayores a cero.`)
      }
      product = { code, name, description, retail, wholesale, image: item.image }
      inventory.catalog.push(product)
    }

    const sizes = new Set()
    if (!item.variants.length) throw new Error(`${label}. Agregá al menos un talle.`)
    for (const variant of item.variants) {
      const size = variant.size.trim().toLocaleUpperCase('es-AR')
      const quantity = Number(variant.quantity)
      if (!size || !/^[0-9]+$/.test(variant.quantity) || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(`${label}. Completá cada talle con una cantidad entera mayor a cero.`)
      }
      if (sizes.has(size)) throw new Error(`${label}. Sumá las unidades del talle ${size} en una sola línea.`)
      sizes.add(size)
      let line = inventory.stock.find(entry => entry.code === product.code && entry.branch === draft.branch && entry.size === size)
      if (!line) {
        line = { code: product.code, branch: draft.branch, size, quantity: 0 }
        inventory.stock.push(line)
      }
      if (!Number.isSafeInteger(line.quantity + quantity) || !Number.isSafeInteger(units + quantity)) {
        throw new Error(`${label}. La cantidad ingresada es demasiado grande.`)
      }
      lines.push({ code: product.code, size, quantity })
      line.quantity += quantity
      units += quantity
    }
    products.set(product.code, { ...product, image: item.image ?? product.image })
  }

  const receipt = { id: draft.id, branch: draft.branch, note: draft.note, units, lines, products: [...products.values()] }
  inventory.receipts.push(receipt)
  return receipt
}

export async function confirmReceipt(draft) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('demo', 'readwrite')
    const store = transaction.objectStore('demo')
    const request = store.get('inventory')
    let result
    let failure

    request.onsuccess = () => {
      try {
        const inventory = request.result ?? seed()
        result = applyReceipt(inventory, draft)
        store.put(inventory, 'inventory')
      } catch (error) {
        failure = error
        transaction.abort()
      }
    }

    transaction.oncomplete = () => resolve(result)
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('No se pudo guardar el ingreso.'))
  })
}
