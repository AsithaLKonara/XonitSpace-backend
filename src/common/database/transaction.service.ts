import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ClockService } from '../services/clock.service';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private clockService: ClockService
  ) {}

  /**
   * Executes a callback within a Serializable transaction.
   * Guarantees idempotency to prevent duplicate operations during network retries or queue replays.
   */
  async executeIdempotent<T>(
    idempotencyKey: string,
    actionType: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const keyRecord = await tx.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });

        if (keyRecord) {
          if (keyRecord.completedAt && keyRecord.response) {
            return keyRecord.response as unknown as T;
          }
          if (keyRecord.lockedAt) {
            throw new ConflictException(`Operation [${actionType}] is currently processing.`);
          }
        }

        await tx.idempotencyKey.upsert({
          where: { key: idempotencyKey },
          create: {
            key: idempotencyKey,
            actionType,
            lockedAt: this.clockService.getDate(),
          },
          update: {
            lockedAt: this.clockService.getDate(),
          },
        });

        const result = await operation(tx);

        await tx.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            completedAt: this.clockService.getDate(),
            lockedAt: null,
            response: result as any,
          },
        });

        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}
