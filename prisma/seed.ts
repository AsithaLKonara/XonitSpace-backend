import { PrismaClient, SystemRole, LeadStage, ProjectStatus, ProjectPriority, TaskStatus, TaskPriority, InvoiceStatus, PaymentMethod, PaymentStatus, CommissionStatus, ContractType, ContractStatus, NotificationType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing database entries in reverse relational order
  await prisma.notification.deleteMany();
  await prisma.file.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.revenue.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.crmNote.deleteMany();
  await prisma.crmLead.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.session.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Existing database records purged.');

  // 2. Pre-hash password
  const passwordHash = await bcrypt.hash('xonit123', 10);

  // 3. Create Users
  const superadmin = await prisma.user.create({
    data: {
      email: 'superadmin@xonit.space',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Vance',
      role: SystemRole.SUPER_ADMIN,
    },
  });

  const pm = await prisma.user.create({
    data: {
      email: 'pm@xonit.space',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Connor',
      role: SystemRole.PROJECT_MANAGER,
    },
  });

  const developer = await prisma.user.create({
    data: {
      email: 'dev@xonit.space',
      passwordHash,
      firstName: 'Gordon',
      lastName: 'Freeman',
      role: SystemRole.EMPLOYEE,
    },
  });

  const client = await prisma.user.create({
    data: {
      email: 'client@xonit.space',
      passwordHash,
      firstName: 'Bruce',
      lastName: 'Wayne',
      role: SystemRole.CUSTOMER,
    },
  });

  const hunter = await prisma.user.create({
    data: {
      email: 'hunter@xonit.space',
      passwordHash,
      firstName: 'John',
      lastName: 'Wick',
      role: SystemRole.INFLUENCER,
    },
  });

  console.log('👤 Users seeded successfully.');

  // 4. Create Employee profiles
  const pmEmployee = await prisma.employee.create({
    data: {
      userId: pm.id,
      jobTitle: 'Senior Project Manager',
      department: 'Product Management',
      skills: ['Agile', 'Scrum', 'Jira', 'Leadership'],
      experienceYears: 8,
    },
  });

  const devEmployee = await prisma.employee.create({
    data: {
      userId: developer.id,
      jobTitle: 'Lead Software Engineer',
      department: 'Engineering',
      skills: ['TypeScript', 'NestJS', 'Next.js', 'PostgreSQL', 'Docker'],
      experienceYears: 5,
    },
  });

  console.log('💼 Employee profiles seeded.');

  // 5. Create Attendance records
  await prisma.attendance.createMany({
    data: [
      {
        employeeId: devEmployee.id,
        clockIn: new Date(Date.now() - 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000),
        clockOut: new Date(Date.now() - 24 * 60 * 60 * 1000),
        workHours: 8.0,
        ipAddress: '127.0.0.1',
      },
      {
        employeeId: devEmployee.id,
        clockIn: new Date(Date.now() - 8 * 60 * 60 * 1000),
        clockOut: new Date(),
        workHours: 8.0,
        ipAddress: '192.168.1.1',
      },
    ],
  });

  // 6. Create Leaves
  await prisma.leave.create({
    data: {
      employeeId: devEmployee.id,
      type: 'CASUAL',
      status: 'APPROVED',
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reason: 'Family event attendance',
      approvedById: pm.id,
    },
  });

  // 7. Create Salaries payroll details
  await prisma.salary.create({
    data: {
      employeeId: devEmployee.id,
      basicSalary: 6500.0,
      allowances: 500.0,
      deductions: 200.0,
      netSalary: 6800.0,
      status: 'PAID',
      paymentDate: new Date(),
    },
  });

  console.log('⏰ HR Attendance, Leaves, & Payroll details seeded.');

  // 8. Create Customers
  const customer = await prisma.customer.create({
    data: {
      companyName: 'Wayne Enterprises',
      contactName: 'Lucius Fox',
      contactEmail: 'lucius.fox@wayne.corp',
      contactPhone: '+1-555-0199',
    },
  });

  // 9. Create CRM Leads
  const lead = await prisma.crmLead.create({
    data: {
      title: 'Enterprise Cyber Security Upgrade',
      value: 12000.0,
      stage: LeadStage.WON,
      customerId: customer.id,
    },
  });

  // 10. Add CRM Notes & Meetings
  await prisma.crmNote.create({
    data: {
      leadId: lead.id,
      content: 'Lucius is interested in migrating key servers to secure architecture.',
      createdById: pm.id,
    },
  });

  await prisma.meeting.create({
    data: {
      title: 'Cyber Security Upgrade kickoff',
      description: 'Discussing scope parameters and deliverables timelines.',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      status: 'SCHEDULED',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      customerId: customer.id,
      leadId: lead.id,
    },
  });

  console.log('🤝 CRM Customer pipeline records seeded.');

  // 11. Create Projects
  const project = await prisma.project.create({
    data: {
      name: 'Cyber Security Shield Upgrade',
      description: 'Securing cloud nodes, implementing zero-trust network gates, and auditing relational database architectures.',
      budget: 12000.0,
      status: ProjectStatus.IN_PROGRESS,
      priority: ProjectPriority.HIGH,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientPortalId: client.id,
      pmId: pmEmployee.id,
    },
  });

  // 12. Create Project Members
  await prisma.projectMember.createMany({
    data: [
      {
        projectId: project.id,
        employeeId: pmEmployee.id,
        role: 'PM',
      },
      {
        projectId: project.id,
        employeeId: devEmployee.id,
        role: 'DEVELOPER',
      },
    ],
  });

  console.log('🚀 Project workspaces initialized.');

  // 13. Create Tasks (Kanban board)
  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Configure PostgreSQL Zero-Trust Policies',
      description: 'Apply row-level security parameters to PostgreSQL targets and isolate tenant data schemas.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      estimationHours: 12.0,
      loggedHours: 4.5,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      assignedToId: devEmployee.id,
      createdById: pm.id,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Audit AWS VPC Cloud Gateways',
      description: 'Audit ingress/egress configurations and verify standard bastion security setups.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      estimationHours: 8.0,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      assignedToId: devEmployee.id,
      createdById: pm.id,
    },
  });

  // Add Task Comments
  await prisma.taskComment.create({
    data: {
      taskId: task1.id,
      userId: developer.id,
      content: 'I have locked down the transaction pooler access configurations. Starting query auditing next.',
    },
  });

  console.log('📋 Kanban Task boards populated.');

  // 14. Create Invoices
  const invoice = await prisma.invoice.create({
    data: {
      projectId: project.id,
      invoiceNumber: 'INV-2026-001',
      subtotal: 5000.0,
      tax: 500.0,
      discount: 200.0,
      total: 5300.0,
      status: InvoiceStatus.SENT,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // 15. Create Payments
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 5300.0,
      method: PaymentMethod.STRIPE,
      transactionId: 'ch_stripe_mock_2026_998822',
      status: PaymentStatus.SUCCESS,
    },
  });

  // Mark invoice as paid
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.PAID },
  });

  // 16. Create Revenue ledger entry
  await prisma.revenue.create({
    data: {
      amount: 5300.0,
      source: 'Invoice Payment: Wayne Enterprises Shield Project',
      category: 'Client Payout',
      description: 'Received client milestone payment clearance.',
    },
  });

  // 17. Create Commissions payouts (Influencers)
  await prisma.commission.create({
    data: {
      hunterId: hunter.id,
      amount: 530.0, // 10% introduction fee
      ratePercentage: 10.0,
      status: CommissionStatus.PENDING,
      projectId: project.id,
      paymentId: payment.id,
    },
  });

  console.log('💳 Billing, payments, revenues, and referral commissions cleared.');

  // 18. Create legal NDA Contracts & upload Files
  await prisma.contract.create({
    data: {
      projectId: project.id,
      title: 'Wayne Shield Service Level NDA Agreement',
      type: ContractType.NDA,
      status: ContractStatus.SIGNED,
      docUrl: 'https://xonit.space/contracts/nda-wayne-shield.pdf',
      signedAt: new Date(),
    },
  });

  await prisma.file.create({
    data: {
      name: 'postgresql-zero-trust-policies-diagram.png',
      fileUrl: 'https://xonit.space/uploads/postgres-shield-flow.png',
      mimeType: 'image/png',
      sizeBytes: 153240,
      projectId: project.id,
      taskId: task1.id,
      uploadedById: developer.id,
    },
  });

  // 19. Send Notifications alert alerts
  await prisma.notification.createMany({
    data: [
      {
        userId: developer.id,
        title: 'New Task Card Assigned',
        message: 'Sarah Connor assigned you: Configure PostgreSQL Zero-Trust Policies.',
        type: NotificationType.INFO,
      },
      {
        userId: pm.id,
        title: 'Task Comment Reply',
        message: 'Gordon Freeman replied to Configure PostgreSQL Zero-Trust Policies.',
        type: NotificationType.SUCCESS,
      },
    ],
  });

  console.log('🔔 Notifications, files, and contracts seeded.');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
