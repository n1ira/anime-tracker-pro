import { AppError, ErrorType } from './errorHandling';

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validator function type
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>;

/**
 * Creates a validation error
 */
export function validationError(message: string): ValidationResult<never> {
  return {
    success: false,
    error: message,
  };
}

/**
 * Creates a successful validation result
 */
export function validationSuccess<T>(data: T): ValidationResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Validates that a value is not null or undefined
 */
export function required<T>(
  value: T | null | undefined,
  message = 'Value is required'
): ValidationResult<T> {
  if (value === null || value === undefined) {
    return validationError(message);
  }
  return validationSuccess(value);
}

/**
 * Validates that a string is not empty
 */
export function nonEmptyString(
  value: unknown,
  message = 'String cannot be empty'
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return validationError('Value must be a string');
  }

  if (value.trim() === '') {
    return validationError(message);
  }

  return validationSuccess(value);
}

/**
 * Validates that a value is a number
 */
export function isNumber(
  value: unknown,
  message = 'Value must be a number'
): ValidationResult<number> {
  if (typeof value !== 'number' || isNaN(value)) {
    return validationError(message);
  }

  return validationSuccess(value);
}

/**
 * Validates that a number is within a range
 */
export function numberInRange(
  value: unknown,
  min: number,
  max: number,
  message = `Value must be between ${min} and ${max}`
): ValidationResult<number> {
  const numberResult = isNumber(value);

  if (!numberResult.success) {
    return numberResult;
  }

  const num = numberResult.data as number;

  if (num < min || num > max) {
    return validationError(message);
  }

  return validationSuccess(num);
}

/**
 * Validates that a string matches a pattern
 */
export function matchesPattern(
  value: unknown,
  pattern: RegExp,
  message = 'Value does not match the required pattern'
): ValidationResult<string> {
  const stringResult = nonEmptyString(value);

  if (!stringResult.success) {
    return stringResult;
  }

  const str = stringResult.data as string;

  if (!pattern.test(str)) {
    return validationError(message);
  }

  return validationSuccess(str);
}

/**
 * Validates an email address
 */
export function isEmail(
  value: unknown,
  message = 'Invalid email address'
): ValidationResult<string> {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return matchesPattern(value, emailPattern, message);
}

/**
 * Validates a URL
 */
export function isUrl(value: unknown, message = 'Invalid URL'): ValidationResult<string> {
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
  return matchesPattern(value, urlPattern, message);
}

/**
 * Validates an array
 */
export function isArray<T>(
  value: unknown,
  itemValidator?: Validator<T>,
  message = 'Value must be an array'
): ValidationResult<T[]> {
  if (!Array.isArray(value)) {
    return validationError(message);
  }

  if (itemValidator) {
    const validatedItems: T[] = [];
    const errors: string[] = [];

    for (let i = 0; i < value.length; i++) {
      const result = itemValidator(value[i]);

      if (result.success && result.data !== undefined) {
        validatedItems.push(result.data);
      } else {
        errors.push(`Item at index ${i}: ${result.error}`);
      }
    }

    if (errors.length > 0) {
      return validationError(errors.join(', '));
    }

    return validationSuccess(validatedItems);
  }

  return validationSuccess(value as T[]);
}

/**
 * Validates an object against a schema
 */
export function validateObject<T>(
  value: unknown,
  schema: Record<keyof T, Validator<any>>,
  message = 'Invalid object'
): ValidationResult<T> {
  if (typeof value !== 'object' || value === null) {
    return validationError(message);
  }

  const result: Partial<T> = {};
  const errors: string[] = [];

  for (const key in schema) {
    if (Object.prototype.hasOwnProperty.call(schema, key)) {
      const validator = schema[key];
      const fieldValue = (value as Record<string, unknown>)[key];
      const fieldResult = validator(fieldValue);

      if (fieldResult.success && fieldResult.data !== undefined) {
        result[key] = fieldResult.data;
      } else {
        errors.push(`${String(key)}: ${fieldResult.error}`);
      }
    }
  }

  if (errors.length > 0) {
    return validationError(errors.join(', '));
  }

  return validationSuccess(result as T);
}

/**
 * Validates data and throws an AppError if validation fails
 */
export function validateOrThrow<T>(data: unknown, validator: Validator<T>): T {
  const result = validator(data);

  if (!result.success) {
    throw new AppError(result.error || 'Validation failed', ErrorType.VALIDATION);
  }

  return result.data as T;
}
