import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Client Portal')
@Controller('api/v1/portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PortalController {
  constructor(private portalService: PortalService) {}

  @Get('projects')
  @Roles(SystemRole.CUSTOMER)
  @ApiOperation({ summary: 'List customer assigned projects' })
  getMyProjects(@GetUser('id') userId: string) {
    return this.portalService.getMyProjects(userId);
  }

  @Get('invoices')
  @Roles(SystemRole.CUSTOMER)
  @ApiOperation({ summary: 'List customer invoices' })
  getMyInvoices(@GetUser('id') userId: string) {
    return this.portalService.getMyInvoices(userId);
  }

  @Get('tickets')
  @Roles(SystemRole.CUSTOMER)
  @ApiOperation({ summary: 'List customer support tickets' })
  getMyTickets(@GetUser('id') userId: string) {
    return this.portalService.getMyTickets(userId);
  }

  @Post('tickets')
  @Roles(SystemRole.CUSTOMER)
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(
    @GetUser('id') userId: string,
    @Body('subject') subject: string,
    @Body('description') description: string,
  ) {
    return this.portalService.createTicket(userId, subject, description);
  }
}
