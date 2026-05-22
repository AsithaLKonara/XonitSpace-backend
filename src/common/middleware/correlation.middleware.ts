import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { IdService } from '../services/id.service';

export interface CorrelationContext {
  traceId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private idService: IdService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const traceId = (req.headers['x-trace-id'] as string) || this.idService.generateUuid();
    
    res.setHeader('X-Trace-Id', traceId);

    correlationStorage.run({ traceId }, () => {
      next();
    });
  }
}
