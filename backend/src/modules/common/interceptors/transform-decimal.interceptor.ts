import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Decimal } from 'decimal.js';

function transformDecimals(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Decimal.isDecimal(obj) || (obj && typeof obj === 'object' && obj.isDecimal)) {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(transformDecimals);
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = transformDecimals(obj[key]);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class TransformDecimalInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transformDecimals(data)));
  }
}
