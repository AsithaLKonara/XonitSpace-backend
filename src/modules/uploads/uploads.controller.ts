import { Controller, Post, UseInterceptors, UploadedFile, Body, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Operations & Files')
@Controller('api/v1/uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        projectId: {
          type: 'string',
          description: 'Optional ID of the project workspace',
        },
        taskId: {
          type: 'string',
          description: 'Optional ID of the Kanban task card',
        },
      },
    },
  })
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') userId: string,
    @Body('projectId') projectId?: string,
    @Body('taskId') taskId?: string,
  ) {
    return this.uploadsService.saveFile(file, userId, projectId, taskId);
  }
}
