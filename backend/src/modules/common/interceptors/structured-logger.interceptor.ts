import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';

@Injectable()
export class StructuredLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const start = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', requestId);

    const { method, originalUrl, ip } = req;
    const user = req.user ? req.user.user_id || req.user.userId || req.user.email : 'anonymous';
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId || '-';
    const clientOpId = req.body?.clientOpId || '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = res.statusCode;
          this.logger.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              requestId,
              method,
              endpoint: originalUrl,
              statusCode,
              durationMs: duration,
              user,
              deviceId,
              clientOpId,
              ip: ip || '-',
            }),
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          const statusCode = err.status || 500;
          this.logger.warn(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              requestId,
              method,
              endpoint: originalUrl,
              statusCode,
              durationMs: duration,
              user,
              deviceId,
              clientOpId,
              ip: ip || '-',
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
