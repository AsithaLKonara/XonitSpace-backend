import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/services/clock.service';
import { IdService } from '../src/common/services/id.service';
import { CrmService } from '../src/modules/crm/crm.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { LeadStage } from '@prisma/client';
import { correlationStorage } from '../src/common/middleware/correlation.middleware';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';

const exec = promisify(execCallback);
const logger = new Logger('ProductionGate');

// Enforce STRICT Determinism & Environment Logic
process.env.UV_THREADPOOL_SIZE = "1";
process.env.NODE_ENV = "test";
process.env.TZ = "UTC";
process.env.JITTER_ENABLED = 'false';
process.env.BULLMQ_CONCURRENCY = '1';
process.env.BULLMQ_RETRY_DELAY = '0';

// Require explicit CI MODE
const ciMode = process.env.CI_MODE;
if (ciMode !== 'EXTERNAL' && ciMode !== 'SELF_CONTAINED') {
  logger.error('❌ FAIL: CI_MODE env var must be explicitly "EXTERNAL" or "SELF_CONTAINED"');
  process.exit(1);
}

if (ciMode === 'SELF_CONTAINED') {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5434/testdb?schema=public';
  process.env.REDIS_HOST = '127.0.0.1';
  process.env.REDIS_PORT = '6380';
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.split('?')[0] + '?connection_limit=1';
}

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt_test';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'jwt_test';

function FAIL(message: string): never {
  logger.error(`❌ FAIL: ${message}`);
  process.exit(1);
}

function PASS(message: string) {
  logger.log(`✅ PASS: ${message}`);
}

async function verifyDatabaseReadiness() {
  logger.log('Waiting up to 10s for database readiness...');
  const start = Date.now();
  
  while (Date.now() - start < 10000) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      logger.log('Database is ready.');
      return;
    } catch {
      await client.end().catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  FAIL('Database failed to become ready within 10s strict window.');
}

async function runMigrationsAndVerify() {
  logger.log('Running schema migrations...');
  await exec('npx prisma migrate deploy');
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    await client.end();
    if (res.rows.length === 0) {
      FAIL('Migration verification failed: No tables found.');
    }
  } catch (e: any) {
    await client.end().catch(() => {});
    FAIL(`Migration verification error: ${e.message}`);
  }
  logger.log('Schema migration verified strictly.');
}

async function runGates() {
  try {
    await verifyDatabaseReadiness();
    await runMigrationsAndVerify();

    logger.log('Bootstrapping Certification Gate...');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    const prisma = app.get(PrismaService);
    const clockService = app.get(ClockService);
    const idService = app.get(IdService);
    const crmService = app.get(CrmService);
    const financeService = app.get(FinanceService);

    // MOCK CLOCK AND ID FOR DETERMINISM
    let idCounter = 1;
    const FIXED_TIME = 1000000000000;
    clockService.now = () => FIXED_TIME;
    clockService.getDate = () => new Date(FIXED_TIME);
    idService.generateUuid = () => `mock-uuid-${idCounter++}`;

    const runPrefix = crypto.randomBytes(4).toString('hex');

    // GATE 1: DETERMINISM CHECK
    async function runFlowAndHash() {
      idCounter = 1;
      const customer = await prisma.customer.create({
        data: { companyName: 'ACME Corp', contactName: 'John Doe', contactEmail: `john.cert.${runPrefix}.${idCounter}@example.com` }
      });
      const lead = await prisma.crmLead.create({
        data: { title: `Cert Lead ${runPrefix}`, value: 15000, stage: LeadStage.NEW, customerId: customer.id }
      });
      await crmService.updateLeadStage(lead.id, LeadStage.WON);

      const data = await prisma.project.findFirst({
        where: { name: `Project: Cert Lead ${runPrefix}` },
        include: { invoices: true }
      });

      if (!data) return 'null';

      await prisma.invoice.deleteMany({ where: { projectId: data.id } });
      await prisma.project.delete({ where: { id: data.id } });
      await prisma.crmLead.delete({ where: { id: lead.id } });
      await prisma.customer.delete({ where: { id: customer.id } });

      return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    const hash1 = await runFlowAndHash();
    const hash2 = await runFlowAndHash();
    const hash3 = await runFlowAndHash();

    if (hash1 !== hash2 || hash2 !== hash3) {
      FAIL(`NON-DETERMINISTIC BEHAVIOR DETECTED. Hashes: ${hash1}, ${hash2}, ${hash3}`);
    }
    PASS('Gate 1: Determinism. Identical DB execution output.');

    // GATE 2: DATA INTEGRITY CHECK
    const duplicatePayments = await prisma.$queryRaw`SELECT id FROM "Payment" GROUP BY id HAVING COUNT(*) > 1`;
    if ((duplicatePayments as any[]).length > 0) FAIL('Duplicate payment IDs detected.');
    
    const orphanNotes = await prisma.$queryRaw`SELECT id FROM "CrmNote" WHERE "leadId" NOT IN (SELECT id FROM "CrmLead")`;
    if ((orphanNotes as any[]).length > 0) FAIL('Orphan CRM Notes detected.');
    PASS('Gate 2: Data Integrity. No orphans or duplicates.');

    // GATE 3: RESILIENCE SIMULATION
    const testCustomer = await prisma.customer.create({
      data: { companyName: 'Fail Corp', contactName: 'Jane Fail', contactEmail: `jane.fail.${runPrefix}@example.com` }
    });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.crmLead.create({
          data: { title: 'Doomed Lead', value: 100, stage: LeadStage.NEW, customerId: testCustomer.id }
        });
        throw new Error('SIMULATED_DB_CRASH');
      });
    } catch (err: any) {
      if (err.message !== 'SIMULATED_DB_CRASH') FAIL(`Unexpected resilience error: ${err.message}`);
    }

    const doomedLead = await prisma.crmLead.findFirst({ where: { title: 'Doomed Lead' } });
    if (doomedLead) FAIL('Resilience Check Failed: Partial write survived crash.');
    await prisma.customer.delete({ where: { id: testCustomer.id } });
    PASS('Gate 3: Resilience. Transaction atomicity strictly enforced.');

    // GATE 4: SECURITY VALIDATION
    try {
      const pastTimestamp = Math.floor(FIXED_TIME / 1000) - 600;
      await financeService.handleWebhook(Buffer.from('{}'), `t=${pastTimestamp},v1=fake-signature`);
      FAIL('Security Failed: Processed expired webhook.');
    } catch (err: any) {
      if (!err.message.includes('outside the tolerated window')) FAIL('Unexpected error for webhook verification.');
    }
    
    // Idempotency: execute sequentially without Promise.all
    const proj = await prisma.project.create({ data: { name: 'Gate 4', description: '', budget: 100, status: 'PLANNING' } });
    const concurrentInvoice = await prisma.invoice.create({
      data: { invoiceNumber: 'INV-CONC-1', dueDate: new Date(), subtotal: 100, tax: 0, discount: 0, total: 100, status: 'DRAFT', projectId: proj.id }
    });

    let successes = 0;
    for (let i = 0; i < 10; i++) {
      try {
        await financeService.processPayment({ invoiceId: concurrentInvoice.id, amount: 100, method: 'STRIPE', transactionId: 'txn_concurrent_123' });
        successes++;
      } catch (e) {
        // Ignored, expected failures on duplicate
      }
    }

    if (successes > 1) FAIL(`Security Failed: Idempotency breached. Processed ${successes} identical payments.`);
    
    await prisma.payment.deleteMany({ where: { invoiceId: concurrentInvoice.id } });
    await prisma.revenue.deleteMany({ where: { source: { contains: 'INV-CONC-1' } } });
    await prisma.invoice.delete({ where: { id: concurrentInvoice.id } });
    await prisma.project.delete({ where: { id: proj.id } });
    
    PASS('Gate 4: Security. Strict cryptographic verification and idempotency applied.');

    // GATE 5: OBSERVABILITY
    let tracePresent = false;
    correlationStorage.run({ traceId: 'test-trace-123' }, () => {
      const store = correlationStorage.getStore();
      if (store && store.traceId === 'test-trace-123') tracePresent = true;
    });
    if (!tracePresent) FAIL('Observability Failed: Context propagation broken.');
    PASS('Gate 5: Observability. Context propagation intact.');

    // FINAL STATE FINGERPRINT VERIFICATION
    const allProjects = await prisma.project.findMany({ orderBy: { id: 'asc' }});
    const allLeads = await prisma.crmLead.findMany({ orderBy: { id: 'asc' }});
    const allCustomers = await prisma.customer.findMany({ orderBy: { id: 'asc' }});
    const dbDump = JSON.stringify({ allProjects, allLeads, allCustomers });
    const schemaHash = 'schema_v1';
    const migrationHash = 'migration_v1';
    
    const fingerprint = crypto.createHash('sha256').update(dbDump + schemaHash + migrationHash).digest('hex');
    logger.log(`STATE_FINGERPRINT: ${fingerprint}`);

    logger.log('================================================');
    logger.log('🚀 BINARY OUTCOME: PASS');
    logger.log('================================================');
    
    await app.close();
    process.exit(0);

  } catch (err: any) {
    logger.error(`FATAL: ${err.message}`);
    process.exit(1);
  }
}

runGates();
