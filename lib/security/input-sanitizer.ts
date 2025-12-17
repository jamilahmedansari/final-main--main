/**
 * Input Sanitization Utilities
 * Provides comprehensive input validation and sanitization for security
 */

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Trim whitespace
  let sanitized = input.trim()

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  // Remove potentially dangerous characters
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers

  return sanitized
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  const email = input.toLowerCase().trim()

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return ''
  }

  return email
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  try {
    const url = new URL(input)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}

/**
 * Sanitize HTML content (removes dangerous tags and attributes)
 */
export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  let sanitized = input

  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove dangerous protocols
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""')

  return sanitized
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    return {}
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    // Sanitize key
    const sanitizedKey = sanitizeString(key, 100)

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) : item
      )
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeJson(value)
    }
  }

  return sanitized
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(input: unknown, min?: number, max?: number): number | null {
  const num = Number(input)

  if (isNaN(num) || !isFinite(num)) {
    return null
  }

  if (min !== undefined && num < min) {
    return null
  }

  if (max !== undefined && num > max) {
    return null
  }

  return num
}

/**
 * Validate and sanitize boolean input
 */
export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') {
    return input
  }

  if (typeof input === 'string') {
    return input.toLowerCase() === 'true' || input === '1'
  }

  return Boolean(input)
}

/**
 * Validate and sanitize array input
 */
export function sanitizeArray(input: unknown, maxLength: number = 100): unknown[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input.slice(0, maxLength)
}

/**
 * Escape SQL special characters (for use with parameterized queries only)
 */
export function escapeSqlString(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/"/g, '\\"')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
}

/**
 * Validate file name to prevent directory traversal
 */
export function sanitizeFileName(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Remove directory traversal attempts
  let sanitized = input
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '') // Remove slashes
    .replace(/^\.+/, '') // Remove leading dots

  // Enforce max length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255)
  }

  return sanitized || 'file'
}

/**
 * Comprehensive input validation
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  data?: Record<string, unknown>
}

export function validateInput(
  input: Record<string, unknown>,
  schema: Record<string, { type: string; required?: boolean; maxLength?: number }>
): ValidationResult {
  const errors: string[] = []
  const data: Record<string, unknown> = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field]

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }

    if (value === undefined || value === null) {
      continue
    }

    // Validate type and sanitize
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`)
        } else {
          data[field] = sanitizeString(value, rules.maxLength)
        }
        break

      case 'email':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`)
        } else {
          const sanitized = sanitizeEmail(value)
          if (!sanitized) {
            errors.push(`${field} must be a valid email`)
          } else {
            data[field] = sanitized
          }
        }
        break

      case 'number':
        const num = sanitizeNumber(value)
        if (num === null) {
          errors.push(`${field} must be a valid number`)
        } else {
          data[field] = num
        }
        break

      case 'boolean':
        data[field] = sanitizeBoolean(value)
        break

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array`)
        } else {
          data[field] = sanitizeArray(value)
        }
        break

      default:
        errors.push(`Unknown type for field ${field}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}
