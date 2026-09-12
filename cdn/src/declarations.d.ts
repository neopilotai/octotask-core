declare module 'validate-npm-package-name' {
  interface ValidationResult {
    errors: string[] | null;
    warnings: string[] | null;
    isValidForNewPackages: boolean;
  }
  function validate(name: string): ValidationResult;
  export = validate;
}
