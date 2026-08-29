const MaterialModel = require('../models/materialModel')

const VALID_UNITS = ['Meter', 'Piece', 'Kilogram', 'Kilo', 'kg']

const materialService = {
  create(userId, { name, quantity, unit, unitPrice, initialPrice, imageUrl, images, colors }) {
    if (!name || !name.trim()) {
      throw { status: 400, message: 'Material name is required.' }
    }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      throw { status: 400, message: 'Quantity must be a positive number.' }
    }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) {
      throw { status: 400, message: 'Unit price must be a non-negative number.' }
    }
    const initPrice = initialPrice !== undefined && initialPrice !== null
      ? parseFloat(initialPrice)
      : 0
    if (isNaN(initPrice) || initPrice < 0) {
      throw { status: 400, message: 'Initial price must be a non-negative number.' }
    }

    // Normalize unit — accept Kilogram/Kilo/kg → store as 'Kilogram'
    let normalizedUnit = unit
    if (unit === 'kg' || unit === 'Kilo') normalizedUnit = 'Kilogram'
    if (!VALID_UNITS.includes(normalizedUnit)) {
      throw { status: 400, message: 'Unit must be Meter, Piece, or Kilogram.' }
    }

    // Parse colors array
    let parsedColors = []
    if (Array.isArray(colors)) {
      parsedColors = colors.map(c => ({
        colorName: c.colorName || c.color || 'Default',
        quantity: parseFloat(c.quantity) || 0,
      }))
    }

    // Build images array: accept images[] or fallback to imageUrl string
    let parsedImages = []
    if (Array.isArray(images) && images.length > 0) {
      parsedImages = images.filter(Boolean)
    } else if (imageUrl) {
      parsedImages = [imageUrl]
    }

    return MaterialModel.create({
      userId,
      name: name.trim(),
      quantity: qty,
      unit: normalizedUnit,
      unitPrice: price,
      initialPrice: initPrice,
      images: parsedImages,
      colors: parsedColors,
    })
  },


  listForUser(userId) {
    return MaterialModel.findByUser(userId)
  },

  // For cashiers: fetch their owner's materials
  listForOwner(ownerId) {
    return MaterialModel.findByOwner(ownerId)
  },

  update(materialId, userId, { name, quantity, unit, unitPrice, initialPrice, images, colors }) {
    if (!name || !name.trim()) {
      throw { status: 400, message: 'Material name is required.' }
    }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) {
      throw { status: 400, message: 'Unit price must be a non-negative number.' }
    }
    const initPrice = initialPrice !== undefined && initialPrice !== null
      ? parseFloat(initialPrice)
      : 0
    if (isNaN(initPrice) || initPrice < 0) {
      throw { status: 400, message: 'Initial price must be a non-negative number.' }
    }

    let normalizedUnit = unit
    if (unit === 'kg' || unit === 'Kilo') normalizedUnit = 'Kilogram'
    if (!VALID_UNITS.includes(normalizedUnit)) {
      throw { status: 400, message: 'Unit must be Meter, Piece, or Kilogram.' }
    }

    let parsedColors = []
    if (Array.isArray(colors)) {
      parsedColors = colors.map(c => ({
        colorName: c.colorName || c.color || 'Default',
        quantity: parseFloat(c.quantity) || 0,
      }))
    }

    let parsedImages = []
    if (Array.isArray(images) && images.length > 0) {
      parsedImages = images.filter(Boolean)
    }

    const updated = MaterialModel.update(materialId, userId, {
      name: name.trim(),
      unit: normalizedUnit,
      unitPrice: price,
      initialPrice: initPrice,
      images: parsedImages,
      colors: parsedColors,
    })
    if (!updated) {
      throw { status: 404, message: 'Material not found or access denied.' }
    }
    return updated
  },

  delete(materialId, userId) {
    const result = MaterialModel.delete(materialId, userId)
    if (result.changes === 0) {
      throw { status: 404, message: 'Material not found or access denied.' }
    }
    return { deleted: true }
  },
}

module.exports = materialService
