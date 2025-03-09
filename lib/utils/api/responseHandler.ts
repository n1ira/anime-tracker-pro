import { NextResponse } from 'next/server';
import { logError } from '../logging';

/**
 * Standard API response format
 */
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode: number;
};

/**
 * Creates a successful API response
 */
export function successResponse<T>(data: T, message?: string, statusCode: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    statusCode
  }, { status: statusCode });
}

/**
 * Creates an error API response
 */
export function errorResponse(error: string | Error, statusCode: number = 500): NextResponse<ApiResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return NextResponse.json({
    success: false,
    error: errorMessage,
    statusCode
  }, { status: statusCode });
}

/**
 * Handles API errors and returns a formatted response
 */
export async function handleApiError(error: unknown, customMessage?: string): Promise<NextResponse<ApiResponse>> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const message = customMessage || 'An error occurred while processing your request';
  
  await logError(`API Error: ${message} - ${errorMessage}`);
  
  return errorResponse(message, 500);
}

/**
 * Validates required parameters in a request
 */
export function validateParams(params: Record<string, any>, requiredParams: string[]): { valid: boolean; missing?: string[] } {
  const missing = requiredParams.filter(param => params[param] === undefined || params[param] === null);
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  return { valid: true };
}

/**
 * Handles API requests with proper error handling
 */
export async function withErrorHandling<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>,
  errorMessage: string = 'An error occurred'
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return await handler();
  } catch (error) {
    return await handleApiError(error, errorMessage);
  }
}

/**
 * Create a not found API response
 * @param resource The resource that was not found
 * @returns NextResponse with standardized format
 */
export function notFoundResponse(resource: string): NextResponse {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Create a bad request API response
 * @param message The error message
 * @returns NextResponse with standardized format
 */
export function badRequestResponse(message: string): NextResponse {
  return errorResponse(message, 400);
} 