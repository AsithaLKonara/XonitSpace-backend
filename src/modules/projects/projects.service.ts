import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDto } from './dto/project.dto';
import { TaskDto } from './dto/task.dto';
import { TaskStatus, ProjectMemberRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async createProject(dto: ProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        budget: dto.budget || 0,
        priority: dto.priority || 'MEDIUM',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async listProjects() {
    return this.prisma.project.findMany({
      include: {
        members: { include: { employee: { include: { user: true } } } },
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectDetails(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: { include: { employee: { include: { user: true } } } },
        tasks: { orderBy: { updatedAt: 'desc' } },
        invoices: true,
        contracts: true,
        files: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async assignMember(projectId: string, employeeId: string, role: ProjectMemberRole) {
    return this.prisma.projectMember.create({
      data: {
        projectId,
        employeeId,
        role,
      },
    });
  }

  async createTask(projectId: string, dto: TaskDto, creatorId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status || TaskStatus.TODO,
        priority: dto.priority || 'MEDIUM',
        estimationHours: dto.estimationHours,
        assignedToId: dto.assignedToId,
        createdById: creatorId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async listProjectTasks(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { include: { user: true } },
        comments: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });
  }

  async addTaskComment(taskId: string, content: string, userId: string) {
    return this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
      },
    });
  }
}
