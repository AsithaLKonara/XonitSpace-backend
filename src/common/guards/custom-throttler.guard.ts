import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.id) {
      return `user-${req.user.id}`;
    }
    // Fallback to IP if user is not authenticated
    return req.ips && req.ips.length ? req.ips[0] : req.ip;
  }
}
