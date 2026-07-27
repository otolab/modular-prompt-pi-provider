export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** ドット区切りの設定パス（例: models.gemma.defaultQueryOptions.maxTokens） */
  path: string;
  message: string;
}

export class ConfigValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const errors = issues.filter((issue) => issue.severity === "error");
    super(formatValidationIssues(errors));
    this.name = "ConfigValidationError";
    this.issues = errors;
  }
}

export class ConfigLoadError extends Error {
  readonly configPath: string;
  readonly cause?: unknown;

  constructor(configPath: string, message: string, cause?: unknown) {
    super(`${message} (${configPath})`);
    this.name = "ConfigLoadError";
    this.configPath = configPath;
    this.cause = cause;
  }
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "Invalid configuration.";
  }
  if (issues.length === 1) {
    const issue = issues[0]!;
    return issue.path ? `${issue.path}: ${issue.message}` : issue.message;
  }
  return [
    "Invalid configuration:",
    ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
  ].join("\n");
}
