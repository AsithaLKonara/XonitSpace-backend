import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { NotificationType } from '@prisma/client';

@ApiTags('In-App Notification Center')
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger/Emit a notification to a specific user (System)' })
  createNotification(
    @Body() dto: {
      userId: string;
      title: string;
      message: string;
      type?: NotificationType;
    },
  ) {
    return this.notificationsService.createNotification(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user notifications feed' })
  getMyNotifications(@GetUser('id') userId: string) {
    return this.notificationsService.getMyNotifications(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an alert notification as read' })
  markAsRead(@Param('id') notificationId: string, @GetUser('id') userId: string) {
    return this.notificationsService.markAsRead(notificationId, userId);
  }
}
