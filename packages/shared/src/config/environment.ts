import { AppError } from "../errors/AppError";

export function validateRequiredEnvironment(
  requiredKeys: readonly string[],
): void {
  const missingKeys = requiredKeys.filter(
    (key) => !process.env[key]?.trim(),
  );

  if (missingKeys.length > 0) {
    throw new AppError(
      500,
      "Required application configuration is missing",
      false,
      {
        code: "CONFIGURATION_MISSING",
        details: { missingKeys },
      },
    );
  }
}
