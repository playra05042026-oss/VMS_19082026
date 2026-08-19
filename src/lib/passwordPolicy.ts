import { PasswordPolicy } from '../types';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  checks: {
    minLength: boolean;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChar: boolean;
  };
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy
): PasswordValidationResult {
  const minLengthPass = (password || '').length >= (policy?.minLength || 10);
  const uppercasePass = policy?.requireUppercase ? /[A-Z]/.test(password || '') : true;
  const numbersPass = policy?.requireNumbers ? /[0-9]/.test(password || '') : true;
  const specialPass = policy?.requireSpecialChar ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password || '') : true;

  const errors: string[] = [];
  if (!minLengthPass) {
    errors.push(`Password must be at least ${policy?.minLength || 10} characters long.`);
  }
  if (!uppercasePass) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }
  if (!numbersPass) {
    errors.push('Password must contain at least one number (0-9).');
  }
  if (!specialPass) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.).');
  }

  return {
    valid: minLengthPass && uppercasePass && numbersPass && specialPass,
    errors,
    checks: {
      minLength: minLengthPass,
      requireUppercase: uppercasePass,
      requireNumbers: numbersPass,
      requireSpecialChar: specialPass
    }
  };
}
