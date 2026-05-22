import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectDto } from './dto/project.dto';
import { TaskDto } from './dto/task.dto';
import { SprintDto } from './dto/sprint.dto';
import { TimeLogDto } from './dto/time-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SystemRole, TaskStatus, ProjectMemberRole } from '@prisma/client';

@ApiTags('Project & Kanban Boards')
@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Create a new project workspace' })
  createProject(@Body() projectDto: ProjectDto) {
    return this.projectsService.createProject(projectDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active project workspaces' })
  listProjects() {
    return this.projectsService.listProjects();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed workspace specifications' })
  getProjectDetails(@Param('id') projectId: string) {
    return this.projectsService.getProjectDetails(projectId);
  }

  @Post(':id/members')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Assign a staff member to a project' })
  assignMember(
    @Param('id') projectId: string,
    @Body('employeeId') employeeId: string,
    @Body('role') role: ProjectMemberRole,
  ) {
    return this.projectsService.assignMember(projectId, employeeId, role);
  }

  @Post(':id/sprints')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Create a new Sprint for a project' })
  createSprint(@Param('id') projectId: string, @Body() sprintDto: any) {
    return this.projectsService.createSprint(projectId, sprintDto);
  }

  @Get(':id/sprints')
  @ApiOperation({ summary: 'List all Sprints in a project' })
  listSprints(@Param('id') projectId: string) {
    return this.projectsService.listSprints(projectId);
  }

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Create a Kanban Task card' })
  createTask(
    @Param('id') projectId: string,
    @Body() taskDto: TaskDto,
    @GetUser('id') creatorId: string,
    @Query('sprintId') sprintId?: string,
  ) {
    return this.projectsService.createTask(projectId, taskDto, creatorId, sprintId);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Get all task cards inside a workspace' })
  listProjectTasks(@Param('id') projectId: string) {
    return this.projectsService.listProjectTasks(projectId);
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Drag & Drop: Move task card status' })
  updateTaskStatus(@Param('taskId') taskId: string, @Query('status') status: TaskStatus) {
    return this.projectsService.updateTaskStatus(taskId, status);
  }

  @Post('tasks/:taskId/comments')
  @ApiOperation({ summary: 'Post a progress comment thread reply' })
  addTaskComment(
    @Param('taskId') taskId: string,
    @Body('content') content: string,
    @GetUser('id') userId: string,
  ) {
    return this.projectsService.addTaskComment(taskId, content, userId);
  }

  @Post('tasks/:taskId/time-logs')
  @ApiOperation({ summary: 'Log time spent on a task' })
  logTaskTime(
    @Param('taskId') taskId: string,
    @Body() timeLogDto: TimeLogDto,
  ) {
    return this.projectsService.logTaskTime(taskId, timeLogDto);
  }
}
