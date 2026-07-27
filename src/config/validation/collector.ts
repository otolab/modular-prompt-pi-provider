import { ConfigValidationError, type ValidationIssue, type ValidationSeverity } from "./types.js";

export class ValidationCollector {
  private readonly issues: ValidationIssue[] = [];

  add(severity: ValidationSeverity, path: string, message: string): void {
    this.issues.push({ severity, path, message });
  }

  error(path: string, message: string): void {
    this.add("error", path, message);
  }

  warn(path: string, message: string): void {
    this.add("warning", path, message);
  }

  getErrors(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === "error");
  }

  getWarnings(): ValidationIssue[] {
    return this.issues.filter((issue) => issue.severity === "warning");
  }

  throwIfErrors(): void {
    const errors = this.getErrors();
    if (errors.length > 0) {
      throw new ConfigValidationError(errors);
    }
  }
}
