import { AppError } from './AppError';

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}
