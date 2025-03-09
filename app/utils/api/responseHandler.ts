import { NextResponse } from 'next/server';

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Create a successful API response
 * @param data The data to return
 * @param message Optional success message
 * @returns NextResponse with standardized format
 */
export function successResponse<T>(data: T, message?: string): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message
  };
  
  return NextResponse.json(response);
}

/**
 * Create an error API response
 * @param error Error message or object
 * @param status HTTP status code
 * @returns NextResponse with standardized format
 */
export function errorResponse(error: string | Error, status: number = 500): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  
  const response: ApiResponse<null> = {
    success: false,
    error: errorMessage
  };
  
  return NextResponse.json(response, { status });
}

/**
 * Handle API errors consistently
 * @param error The error that occurred
 * @param context Optional context for logging
 * @returns NextResponse with standardized error format
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  const contextPrefix = context ? `[${context}] ` : '';
  
  console.error(`${contextPrefix}API Error:`, error);
  
  return errorResponse(errorMessage);
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