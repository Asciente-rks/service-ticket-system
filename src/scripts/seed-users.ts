import { sequelize, connectDB } from '../config/db';
import { User } from '../modules/users/models/user.model';
import { Role } from '../modules/users/models/role.model';
import { Organization } from '../modules/organizations/models/organization.model';
import bcrypt from 'bcryptjs';

interface SeedUser {
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'Developer' | 'Tester';
  password: string;
}

// Fixed identifiers so the demo org is stable across re-seeds.
const DEMO_ORG_ID = 'd0000000-0000-4000-8000-000000000001';
const DEMO_ORG_NAME = 'Demo Organization';
const DEMO_ORG_SLUG = 'demo-organization';
const DEMO_ORG_INVITE = 'DEMO-CREW';

const SEED_USERS: SeedUser[] = [
  {
    name: 'Super Admin',
    email: 'superadmin@test.com',
    role: 'SuperAdmin',
    password: 'Password123!',
  },
  {
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'Admin',
    password: 'Password123!',
  },
  {
    name: 'Developer User',
    email: 'developer@test.com',
    role: 'Developer',
    password: 'Password123!',
  },
  {
    name: 'Tester User',
    email: 'tester@test.com',
    role: 'Tester',
    password: 'Password123!',
  },
];

export interface SeedOptions {
  manageConnection?: boolean;
  silent?: boolean;
}

export const runSeedUsers = async (opts: SeedOptions = {}): Promise<void> => {
  const { manageConnection = true, silent = false } = opts;
  if (manageConnection) {
    await connectDB();
  }

  if (!silent) console.log('--- SEEDING DEMO ORGANIZATION + 4 ACCOUNTS ---');

  // Ensure the demo organization exists (owner set after users are created).
  await Organization.upsert({
    id: DEMO_ORG_ID,
    name: DEMO_ORG_NAME,
    slug: DEMO_ORG_SLUG,
    inviteCode: DEMO_ORG_INVITE,
    ownerId: null,
  });

  let superAdminId: string | null = null;

  for (const seed of SEED_USERS) {
    const role = await Role.findOne({ where: { name: seed.role } });

    if (!role) {
      throw new Error(
        `Role '${seed.role}' not found. Run seed-roles before seed-users.`,
      );
    }

    const hashedPassword = await bcrypt.hash(seed.password, 10);
    const email = seed.email.trim().toLowerCase();

    await User.upsert({
      name: seed.name,
      email,
      password: hashedPassword,
      roleId: role.id,
      organizationId: DEMO_ORG_ID,
    });

    const persisted = await User.findOne({ where: { email } });
    if (persisted && seed.role === 'SuperAdmin') {
      superAdminId = persisted.id;
    }

    if (!silent) {
      console.log(`UPSERTED: ${email} (${seed.role}) -> ${DEMO_ORG_NAME}`);
    }
  }

  // Point the demo org's owner at the SuperAdmin account.
  if (superAdminId) {
    await Organization.update({ ownerId: superAdminId }, { where: { id: DEMO_ORG_ID } });
  }

  if (!silent) {
    console.log('-------------------------------');
    console.log(`Demo org "${DEMO_ORG_NAME}" — invite code: ${DEMO_ORG_INVITE}`);
    console.log('All seeded accounts share the password: Password123!');
    console.log('-------------------------------');
  }

  if (manageConnection) {
    await sequelize.close();
  }
};

if (require.main === module) {
  runSeedUsers()
    .then(() => {
      console.log('Seed complete. You can now log in.');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('CRITICAL SEED ERROR:', error?.message || error);
      process.exit(1);
    });
}
