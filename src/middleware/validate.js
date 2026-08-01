// Simple validation helper
function validate(schema) {
  return (req, res, next) => {
    const errors = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field]

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` })
        continue
      }

      if (value !== undefined && value !== '') {
        if (rules.minLength && String(value).length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` })
        }
        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` })
        }
        if (rules.pattern && !rules.pattern.test(String(value))) {
          errors.push({ field, message: rules.patternMessage || `${field} format is invalid` })
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` })
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors })
    }

    next()
  }
}

module.exports = { validate }
