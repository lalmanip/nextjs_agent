export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

export function isHttpError(status: number): boolean {
  return status >= 400 && status < 600;
}

export function formatApiError(status: number, message: string) {
  return {
    error: true,
    status,
    message,
    timestamp: new Date().toISOString(),
  };
}
