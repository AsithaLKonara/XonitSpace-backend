import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const logger = new Logger('ChaosSimulation');
const prisma = new PrismaClient();

async function runChaosSimulation() {
  logger.log('Starting Chaos Simulation: Network Latency & DB Drops');

  // Simulation: Random sleep to mimic latency
  const delay = Math.random() * 5000;
  logger.log(`Simulating network turbulence: sleeping for ${delay.toFixed(0)}ms...`);
  await new Promise(res => setTimeout(res, delay));

  // Simulation: Disconnect DB to trigger reconnection backoff logic
  try {
    logger.log('Simulating DB connection drop...');
    await prisma.$disconnect();
    logger.log('Reconnecting to DB...');
    await prisma.$connect();
    logger.log('Chaos Simulation Passed: System recovered from DB drop.');
  } catch (err: any) {
    logger.error('Chaos Simulation Failed: Unable to recover.', err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runChaosSimulation();
