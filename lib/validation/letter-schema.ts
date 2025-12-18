/**
 * Letter Generation Input Validation Schema
 * Comprehensive validation for letter generation inputs
 */

import { validateInput, ValidationResult } from '@/lib/security/input-sanitizer'

// Define the letter intake data schema
export interface LetterIntakeSchema {
  senderName: { type: 'string'; required: true; maxLength: 100 }
  senderAddress: { type: 'string'; required: true; maxLength: 500 }
  senderEmail?: { type: 'email'; required: false }
  senderPhone?: { type: 'string'; required: false; maxLength: 20 }
  recipientName: { type: 'string'; required: true; maxLength: 100 }
  recipientAddress: { type: 'string'; required: true; maxLength: 500 }
  recipientEmail?: { type: 'email'; required: false }
  recipientPhone?: { type: 'string'; required: false; maxLength: 20 }
  issueDescription: { type: 'string'; required: true; maxLength: 2000 }
  desiredOutcome: { type: 'string'; required: true; maxLength: 1000 }
  amountDemanded?: { type: 'number'; required: false; min: 0; max: 10000000 }
  deadlineDate?: { type: 'string'; required: false; maxLength: 50 }
  incidentDate?: { type: 'string'; required: false; maxLength: 50 }
  additionalDetails?: { type: 'string'; required: false; maxLength: 3000 }
  attachments?: { type: 'array'; required: false }
}

// Define letter type schemas
export const LETTER_TYPE_SCHEMAS: Record<string, LetterIntakeSchema> = {
  'Demand Letter': {
    senderName: { type: 'string', required: true, maxLength: 100 },
    senderAddress: { type: 'string', required: true, maxLength: 500 },
    senderEmail: { type: 'email', required: false },
    senderPhone: { type: 'string', required: false, maxLength: 20 },
    recipientName: { type: 'string', required: true, maxLength: 100 },
    recipientAddress: { type: 'string', required: true, maxLength: 500 },
    recipientEmail: { type: 'email', required: false },
    recipientPhone: { type: 'string', required: false, maxLength: 20 },
    issueDescription: { type: 'string', required: true, maxLength: 2000 },
    desiredOutcome: { type: 'string', required: true, maxLength: 1000 },
    amountDemanded: { type: 'number', required: false, min: 0, max: 10000000 },
    deadlineDate: { type: 'string', required: false, maxLength: 50 },
    incidentDate: { type: 'string', required: false, maxLength: 50 },
    additionalDetails: { type: 'string', required: false, maxLength: 3000 },
    attachments: { type: 'array', required: false }
  },
  'Cease and Desist': {
    senderName: { type: 'string', required: true, maxLength: 100 },
    senderAddress: { type: 'string', required: true, maxLength: 500 },
    senderEmail: { type: 'email', required: false },
    senderPhone: { type: 'string', required: false, maxLength: 20 },
    recipientName: { type: 'string', required: true, maxLength: 100 },
    recipientAddress: { type: 'string', required: true, maxLength: 500 },
    recipientEmail: { type: 'email', required: false },
    recipientPhone: { type: 'string', required: false, maxLength: 20 },
    issueDescription: { type: 'string', required: true, maxLength: 2000 },
    desiredOutcome: { type: 'string', required: true, maxLength: 1000 },
    deadlineDate: { type: 'string', required: false, maxLength: 50 },
    additionalDetails: { type: 'string', required: false, maxLength: 3000 },
    attachments: { type: 'array', required: false }
  },
  'Legal Notice': {
    senderName: { type: 'string', required: true, maxLength: 100 },
    senderAddress: { type: 'string', required: true, maxLength: 500 },
    senderEmail: { type: 'email', required: false },
    senderPhone: { type: 'string', required: false, maxLength: 20 },
    recipientName: { type: 'string', required: true, maxLength: 100 },
    recipientAddress: { type: 'string', required: true, maxLength: 500 },
    recipientEmail: { type: 'email', required: false },
    recipientPhone: { type: 'string', required: false, maxLength: 20 },
    issueDescription: { type: 'string', required: true, maxLength: 2000 },
    desiredOutcome: { type: 'string', required: true, maxLength: 1000 },
    incidentDate: { type: 'string', required: false, maxLength: 50 },
    additionalDetails: { type: 'string', required: false, maxLength: 3000 },
    attachments: { type: 'array', required: false }
  },
  'Warning Letter': {
    senderName: { type: 'string', required: true, maxLength: 100 },
    senderAddress: { type: 'string', required: true, maxLength: 500 },
    senderEmail: { type: 'email', required: false },
    senderPhone: { type: 'string', required: false, maxLength: 20 },
    recipientName: { type: 'string', required: true, maxLength: 100 },
    recipientAddress: { type: 'string', required: true, maxLength: 500 },
    recipientEmail: { type: 'email', required: false },
    recipientPhone: { type: 'string', required: false, maxLength: 20 },
    issueDescription: { type: 'string', required: true, maxLength: 2000 },
    desiredOutcome: { type: 'string', required: true, maxLength: 1000 },
    additionalDetails: { type: 'string', required: false, maxLength: 3000 },
    attachments: { type: 'array', required: false }
  },
  'Follow-up Letter': {
    senderName: { type: 'string', required: true, maxLength: 100 },
    senderAddress: { type: 'string', required: true, maxLength: 500 },
    senderEmail: { type: 'email', required: false },
    senderPhone: { type: 'string', required: false, maxLength: 20 },
    recipientName: { type: 'string', required: true, maxLength: 100 },
    recipientAddress: { type: 'string', required: true, maxLength: 500 },
    recipientEmail: { type: 'email', required: false },
    recipientPhone: { type: 'string', required: false, maxLength: 20 },
    issueDescription: { type: 'string', required: true, maxLength: 2000 },
    desiredOutcome: { type: 'string', required: true, maxLength: 1000 },
    additionalDetails: { type: 'string', required: false, maxLength: 3000 },
    attachments: { type: 'array', required: false }
  }
}

// List of allowed letter types
export const ALLOWED_LETTER_TYPES = Object.keys(LETTER_TYPE_SCHEMAS)

// Forbidden patterns to prevent injection attacks
export const FORBIDDEN_PATTERNS = [
  // Script injections
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,

  // SQL injection patterns
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(--|\/\*|\*\/)/g,
  /(\bor\s+1\s*=\s*1\b)/gi,
  /(\band\s+1\s*=\s*1\b)/gi,

  // Path traversal
  /\.\.\//g,
  /\.\.\\/g,

  // Command injection
  /(;|\||&|\$\(|`)/g,

  // XSS patterns
  /<iframe\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /<embed\b[^>]*>/gi,

  // Excessive whitespace (potential DoS)
  / {20,}/g,
  /\t{10,}/g,
  /\n{10,}/g,

  // Potential prompt injection for AI
  /ignore\s+previous\s+instructions/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /\[SYSTEM\]/gi,
  /\[ADMIN\]/gi
]

// Advanced validation functions
export function containsForbiddenPatterns(input: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(input))
}

export function validateLetterType(letterType: string): { valid: boolean; error?: string } {
  if (!letterType || typeof letterType !== 'string') {
    return { valid: false, error: 'Letter type is required' }
  }

  if (!ALLOWED_LETTER_TYPES.includes(letterType)) {
    return {
      valid: false,
      error: `Invalid letter type. Allowed types: ${ALLOWED_LETTER_TYPES.join(', ')}`
    }
  }

  return { valid: true }
}

export function validateIntakeData(letterType: string, intakeData: unknown): ValidationResult {
  const letterTypeValidation = validateLetterType(letterType)
  if (!letterTypeValidation.valid) {
    return {
      valid: false,
      errors: [letterTypeValidation.error!]
    }
  }

  if (!intakeData || typeof intakeData !== 'object') {
    return {
      valid: false,
      errors: ['Intake data must be a valid object']
    }
  }

  const schema = LETTER_TYPE_SCHEMAS[letterType]
  const result = validateInput(intakeData as Record<string, unknown>, schema)

  // Additional custom validations
  const errors = [...result.errors]
  const data = result.data || {}

  // Check for forbidden patterns in string fields
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && containsForbiddenPatterns(value)) {
      errors.push(`${key} contains forbidden content`)
      delete data[key]
    }
  }

  // Validate email format consistency
  if (data.senderEmail && !data.senderEmail.includes('@')) {
    errors.push('Invalid sender email format')
    delete data.senderEmail
  }

  if (data.recipientEmail && !data.recipientEmail.includes('@')) {
    errors.push('Invalid recipient email format')
    delete data.recipientEmail
  }

  // Validate phone number format (basic check)
  const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/
  if (data.senderPhone && !phoneRegex.test(data.senderPhone as string)) {
    errors.push('Invalid sender phone number format')
    delete data.senderPhone
  }

  if (data.recipientPhone && !phoneRegex.test(data.recipientPhone as string)) {
    errors.push('Invalid recipient phone number format')
    delete data.recipientPhone
  }

  // Validate date format (basic check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/
  if (data.deadlineDate && !dateRegex.test(data.deadlineDate as string)) {
    errors.push('Invalid deadline date format. Use YYYY-MM-DD or MM/DD/YYYY')
    delete data.deadlineDate
  }

  if (data.incidentDate && !dateRegex.test(data.incidentDate as string)) {
    errors.push('Invalid incident date format. Use YYYY-MM-DD or MM/DD/YYYY')
    delete data.incidentDate
  }

  // Validate reasonable amount ranges
  if (data.amountDemanded !== undefined) {
    const amount = data.amountDemanded as number
    if (amount < 0 || amount > 10000000) {
      errors.push('Amount must be between $0 and $10,000,000')
      delete data.amountDemanded
    }
  }

  // Check for minimum content requirements
  if (data.issueDescription && (data.issueDescription as string).length < 20) {
    errors.push('Issue description must be at least 20 characters long')
  }

  if (data.desiredOutcome && (data.desiredOutcome as string).length < 10) {
    errors.push('Desired outcome must be at least 10 characters long')
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

export function sanitizePromptInput(text: string): string {
  return text
    .trim()
    // Remove potential prompt injection attempts
    .replace(/ignore\s+previous\s+instructions/gi, '')
    .replace(/system\s*:/gi, '')
    .replace(/assistant\s*:/gi, '')
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/\[ADMIN\]/gi, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Limit length to prevent DoS
    .substring(0, 5000)
}

// Main validation function for letter generation requests
export function validateLetterGenerationRequest(
  letterType: unknown,
  intakeData: unknown
): ValidationResult {
  // Validate letter type
  if (!letterType || typeof letterType !== 'string') {
    return {
      valid: false,
      errors: ['Letter type is required and must be a string']
    }
  }

  // Validate and sanitize intake data
  const intakeValidation = validateIntakeData(letterType, intakeData)

  return intakeValidation
}

// Export for use in API routes
export { sanitizeString, sanitizeNumber, sanitizeEmail, sanitizeBoolean } from '@/lib/security/input-sanitizer'