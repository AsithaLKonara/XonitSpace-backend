import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, PrismaHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process alive check for Kubernetes' })
  checkLiveness() {
    return { status: 'UP' };
  }

  @Get('startup')
  @ApiOperation({ summary: 'Boot completed check' })
  checkStartup() {
    return { status: 'INITIALIZED' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database and cache reachable check' })
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}
