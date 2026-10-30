import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // Default demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.ai' },
    update: {},
    create: {
      googleId: 'demo-google-id-001',
      email: 'demo@reachinbox.ai',
      name: 'ReachInbox Demo Operator',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    },
  });

  // Default demo tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: 'ReachInbox Workspace' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'ReachInbox Workspace',
      },
    });
  }

  // Membership
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  // Default sender
  const sender = await prisma.emailSender.upsert({
    where: {
      tenantId_senderEmail: {
        tenantId: tenant.id,
        senderEmail: 'marketing@reachinbox.ai',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      senderEmail: 'marketing@reachinbox.ai',
      displayName: 'ReachInbox Marketing',
      isActive: true,
    },
  });

  console.log(`Seeding complete: User ${user.email}, Tenant ${tenant.name}, Sender ${sender.senderEmail}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
