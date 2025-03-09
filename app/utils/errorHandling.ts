import { toast } from 'sonner';

/**
 * Error types for the application
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Application error class with additional context
 */
export class AppError extends Error {
  type: ErrorType;
  originalError?: unknown;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    originalError?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
  }
}

/**
 * Handles API response errors
 */
export function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new AppError(
      `API request failed with status ${response.status}`,
      response.status === 404
        ? ErrorType.NOT_FOUND
        : response.status === 401
          ? ErrorType.AUTHENTICATION
          : response.status === 403
            ? ErrorType.AUTHORIZATION
            : ErrorType.API,
      response
    );
  }
  return response.json();
}

/**
 * Handles fetch errors
 */
export async function fetchWithErrorHandling<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    return await handleApiResponse<T>(response);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AppError('Network error. Please check your connection.', ErrorType.NETWORK, error);
    }

    throw new AppError('An unexpected error occurred', ErrorType.UNKNOWN, error);
  }
}

/**
 * Displays an error toast with appropriate message based on error type
 */
export function showErrorToast(error: unknown): void {
  if (error instanceof AppError) {
    switch (error.type) {
      case ErrorType.NETWORK:
        toast.error('Network Error', {
          description: 'Please check your internet connection and try again.',
        });
        break;
      case ErrorType.AUTHENTICATION:
        toast.error('Authentication Error', {
          description: 'Please sign in to continue.',
        });
        break;
      case ErrorType.AUTHORIZATION:
        toast.error('Authorization Error', {
          description: 'You do not have permission to perform this action.',
        });
        break;
      case ErrorType.NOT_FOUND:
        toast.error('Not Found', {
          description: 'The requested resource was not found.',
        });
        break;
      case ErrorType.VALIDATION:
        toast.error('Validation Error', {
          description: error.message,
        });
        break;
      default:
        toast.error('Error', {
          description: error.message || 'An unexpected error occurred.',
        });
    }

    // Log detailed error information to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        originalError: error.originalError,
        context: error.context,
      });
    }
  } else {
    toast.error('Error', {
      description: error instanceof Error ? error.message : 'An unexpected error occurred.',
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('Unhandled error:', error);
    }
  }
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler: (error: unknown) => void = showErrorToast
): Promise<T | undefined> {
  return fn().catch(error => {
    errorHandler(error);
    return undefined;
  });
}

/**
 * Validates form data against a schema
 */
export function validateFormData<T>(
  data: unknown,
  validator: (data: unknown) => { success: boolean; error?: Error; data?: T }
): T {
  const result = validator(data);

  if (!result.success) {
    throw new AppError(
      result.error?.message || 'Validation failed',
      ErrorType.VALIDATION,
      result.error
    );
  }

  return result.data as T;
}
