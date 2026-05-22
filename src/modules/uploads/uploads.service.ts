import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { ClockService } from '../../common/services/clock.service';

// S3 integration is loaded dynamically to support graceful fallback to local storage
// when AWS credentials are not configured.
let s3Client: any = null;
let PutObjectCommand: any = null;
let DeleteObjectCommand: any = null;

async function loadS3() {
  if (s3Client) return true;
  try {
    const { S3Client, PutObjectCommand: Put, DeleteObjectCommand: Del } = await import('@aws-sdk/client-s3');
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return false;
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      // Cloudflare R2 support via custom endpoint
      ...(process.env.AWS_ENDPOINT ? { endpoint: process.env.AWS_ENDPOINT } : {}),
    });
    PutObjectCommand = Put;
    DeleteObjectCommand = Del;
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.join(process.cwd(), 'public/uploads');
  private readonly bucket = process.env.AWS_BUCKET_NAME || '';

  constructor(
    private prisma: PrismaService,
    private clockService: ClockService
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    // Attempt to warm S3 on startup (non-blocking)
    loadS3().then(ok => {
      if (ok) console.log('☁️  S3/R2 storage client ready');
      else console.log('💾 Using local file storage (no S3 credentials detected)');
    });
  }

  async saveFile(
    file: Express.Multer.File,
    uploadedById: string,
    projectId?: string,
    taskId?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const timestamp = this.clockService.now();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueFileName = `${timestamp}_${cleanFileName}`;

    let fileUrl: string;

    const s3Ready = await loadS3();
    if (!s3Ready || !this.bucket) {
      throw new BadRequestException('S3/R2 configuration is missing or invalid in production environment');
    }

    // ── Upload to S3 / R2 ──────────────────────────────────────────────────
    const key = `uploads/${uniqueFileName}`;
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      const endpoint = process.env.AWS_ENDPOINT
        ? `${process.env.AWS_ENDPOINT}/${this.bucket}/${key}`
        : `https://${this.bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      fileUrl = endpoint;
      console.log(`☁️  File uploaded to S3/R2: ${key}`);
    } catch (err) {
      console.error('❌ S3 upload failed:', err);
      throw new Error(`Cloud storage upload failed: ${err.message}`);
    }

    return this.prisma.file.create({
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
  }

  private _saveLocally(file: Express.Multer.File, uniqueFileName: string): string {
    const filePath = path.join(this.uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/${uniqueFileName}`;
  }

  async getFileDetails(fileId: string) {
    return this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async listProjectFiles(projectId: string) {
    return this.prisma.file.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
