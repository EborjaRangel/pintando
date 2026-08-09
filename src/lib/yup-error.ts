export function yupErrorDetails(error: unknown): string[] | undefined {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "ValidationError" &&
    "errors" in error &&
    Array.isArray((error as { errors: unknown }).errors)
  ) {
    return (error as { errors: string[] }).errors;
  }
  return undefined;
}
