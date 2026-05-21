import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  create(@Body() body: { customerId: string; subject: string; description: string }) {
    return this.ticketsService.create(body.customerId, body.subject, body.description);
  }

  @Get()
  findAll(@Query('status') status?: TicketStatus) {
    return this.ticketsService.findAll(status);
  }

  @Get('stats')
  getStats() {
    return this.ticketsService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: TicketStatus }) {
    return this.ticketsService.updateStatus(id, body.status);
  }
}
