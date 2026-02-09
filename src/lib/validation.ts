/**
 * Frontend input validation and sanitization utilities
 */

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return ''
  
  // Remove any HTML/script tags and dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!email || typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' })
  } else if (email.length > 254) {
    errors.push({ field: 'email', message: 'Email is too long' })
  } else {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!pattern.test(email)) {
      errors.push({ field: 'email', message: 'Invalid email format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate password strength
 */
export const validatePassword = (password: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' })
  } else if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' })
  } else if (password.length > 128) {
    errors.push({ field: 'password', message: 'Password is too long' })
  } else {
    // Check for complexity
    if (!/[A-Z]/.test(password)) {
      errors.push({ field: 'password', message: 'Password must contain uppercase letter' })
    }
    if (!/[a-z]/.test(password)) {
      errors.push({ field: 'password', message: 'Password must contain lowercase letter' })
    }
    if (!/[0-9]/.test(password)) {
      errors.push({ field: 'password', message: 'Password must contain number' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!phone || typeof phone !== 'string') {
    errors.push({ field: 'phone', message: 'Phone number is required' })
  } else if (phone.length > 20) {
    errors.push({ field: 'phone', message: 'Phone number is too long' })
  } else {
    const pattern = /^[\d\-+()\s]{7,20}$/
    if (!pattern.test(phone)) {
      errors.push({ field: 'phone', message: 'Invalid phone number format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate hall ticket number
 */
export const validateHallTicket = (ticket: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!ticket || typeof ticket !== 'string') {
    errors.push({ field: 'hall_ticket', message: 'Hall ticket is required' })
  } else if (ticket.length > 50) {
    errors.push({ field: 'hall_ticket', message: 'Hall ticket is too long' })
  } else {
    const pattern = /^[a-zA-Z0-9-]{3,50}$/
    if (!pattern.test(ticket)) {
      errors.push({ field: 'hall_ticket', message: 'Invalid hall ticket format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate gate pass form
 */
export interface GatePassFormData {
  pass_type: 'day' | 'overnight' | 'weekend' | 'emergency'
  purpose: string
  destination: string
  exit_date: string
  exit_time: string
  expected_return_date: string
  expected_return_time: string
  remarks?: string
}

export const validateGatePassForm = (data: Partial<GatePassFormData>): ValidationResult => {
  const errors: ValidationError[] = []
  const MAX_CHAR = 500
  const MAX_TEXT = 5000

  // Purpose validation
  if (!data.purpose || typeof data.purpose !== 'string') {
    errors.push({ field: 'purpose', message: 'Purpose is required' })
  } else if (data.purpose.length > MAX_TEXT) {
    errors.push({ field: 'purpose', message: `Purpose cannot exceed ${MAX_TEXT} characters` })
  } else if (data.purpose.trim().length === 0) {
    errors.push({ field: 'purpose', message: 'Purpose cannot be empty' })
  }

  // Destination validation
  if (!data.destination || typeof data.destination !== 'string') {
    errors.push({ field: 'destination', message: 'Destination is required' })
  } else if (data.destination.length > MAX_CHAR) {
    errors.push({ field: 'destination', message: `Destination cannot exceed ${MAX_CHAR} characters` })
  } else if (data.destination.trim().length === 0) {
    errors.push({ field: 'destination', message: 'Destination cannot be empty' })
  }

  // Pass type validation
  if (!data.pass_type) {
    errors.push({ field: 'pass_type', message: 'Pass type is required' })
  } else if (!['day', 'overnight', 'weekend', 'emergency'].includes(data.pass_type)) {
    errors.push({ field: 'pass_type', message: 'Invalid pass type' })
  }

  // Date validations
  if (!data.exit_date) {
    errors.push({ field: 'exit_date', message: 'Exit date is required' })
  } else {
    const exitDate = new Date(data.exit_date)
    if (isNaN(exitDate.getTime())) {
      errors.push({ field: 'exit_date', message: 'Invalid exit date' })
    }
  }

  if (!data.exit_time) {
    errors.push({ field: 'exit_time', message: 'Exit time is required' })
  } else if (!/^\d{2}:\d{2}$/.test(data.exit_time)) {
    errors.push({ field: 'exit_time', message: 'Invalid exit time format' })
  }

  if (!data.expected_return_date) {
    errors.push({ field: 'expected_return_date', message: 'Return date is required' })
  } else {
    const returnDate = new Date(data.expected_return_date)
    if (isNaN(returnDate.getTime())) {
      errors.push({ field: 'expected_return_date', message: 'Invalid return date' })
    }
  }

  if (!data.expected_return_time) {
    errors.push({ field: 'expected_return_time', message: 'Return time is required' })
  } else if (!/^\d{2}:\d{2}$/.test(data.expected_return_time)) {
    errors.push({ field: 'expected_return_time', message: 'Invalid return time format' })
  }

  // Remarks validation (optional)
  if (data.remarks && typeof data.remarks === 'string' && data.remarks.length > MAX_TEXT) {
    errors.push({ field: 'remarks', message: `Remarks cannot exceed ${MAX_TEXT} characters` })
  }

  // Cross-field validation: return date must be after exit date
  if (data.exit_date && data.expected_return_date) {
    const exitDate = new Date(data.exit_date)
    const returnDate = new Date(data.expected_return_date)
    if (returnDate < exitDate) {
      errors.push({ 
        field: 'expected_return_date', 
        message: 'Return date must be after exit date' 
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate date is not in the past
 */
export const validateFutureDate = (dateStr: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!dateStr) {
    errors.push({ field: 'date', message: 'Date is required' })
  } else {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      errors.push({ field: 'date', message: 'Invalid date format' })
    } else if (date < new Date()) {
      errors.push({ field: 'date', message: 'Date cannot be in the past' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get first validation error message
 */
export const getFirstError = (result: ValidationResult): string => {
  if (result.errors.length > 0) {
    return result.errors[0].message
  }
  return ''
}

/**
 * Get error for specific field
 */
export const getFieldError = (result: ValidationResult, fieldName: string): string => {
  const error = result.errors.find(e => e.field === fieldName)
  return error ? error.message : ''
}
