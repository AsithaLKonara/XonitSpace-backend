import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { CustomerDto } from './dto/customer.dto';
import { LeadDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SystemRole, LeadStage } from '@prisma/client';

@ApiTags('CRM Pipeline Management')
@Controller('api/v1/crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Post('customers')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Register a new customer profile' })
  createCustomer(@Body() customerDto: CustomerDto) {
    return this.crmService.createCustomer(customerDto);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List all customer profiles' })
  listCustomers() {
    return this.crmService.listCustomers();
  }

  @Post('leads')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Create a new CRM Lead' })
  createLead(@Body() leadDto: LeadDto) {
    return this.crmService.createLead(leadDto);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List all CRM Leads' })
  listLeads() {
    return this.crmService.listLeads();
  }

  @Patch('leads/:id/stage')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Advance a CRM Lead to another stage' })
  updateLeadStage(@Param('id') leadId: string, @Query('stage') stage: LeadStage) {
    return this.crmService.updateLeadStage(leadId, stage);
  }

  @Post('leads/:id/notes')
  @ApiOperation({ summary: 'Add an action note to a lead' })
  addNote(
    @Param('id') leadId: string,
    @Body('content') content: string,
    @GetUser('id') userId: string,
  ) {
    return this.crmService.addNote(leadId, content, userId);
  }

  @Post('meetings')
  @ApiOperation({ summary: 'Schedule a CRM or client meeting' })
  scheduleMeeting(
    @Body() dto: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      customerId?: string;
      leadId?: string;
    },
  ) {
    return this.crmService.scheduleMeeting(dto);
  }

  @Get('meetings')
  @ApiOperation({ summary: 'List all scheduled meetings' })
  listMeetings() {
    return this.crmService.listMeetings();
  }
}
