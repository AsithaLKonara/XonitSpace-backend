import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.join(process.cwd(), 'public/uploads');

  constructor(private prisma: PrismaService) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(
    file: Express.Multer.File,
    uploadedById: string,
    projectId?: string,
    taskId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Generate unique name
    const timestamp = Date.now();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueFileName = `${timestamp}_${cleanFileName}`;
    const filePath = path.join(this.uploadDir, uniqueFileName);

    try {
      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Create static path url
      const fileUrl = `/uploads/${uniqueFileName}`;

      // Save to database
      const savedFile = await this.prisma.file.create({
        data: {
          name: file.originalname,
          fileUrl,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          projectId: projectId || null,
          taskId: taskId || null,
          uploadedById,
        },
      });

      return savedFile;
    } catch (error) {
      console.error('❌ Error saving file attachment:', error);
      throw new BadRequestException('Could not save file attachment');
    }
  }

  async getFileDetails(fileId: string) {
    return this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async listProjectFiles(projectId: string) {
    return this.prisma.file.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
