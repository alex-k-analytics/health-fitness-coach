import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "test@example.com";
  const password = "password123";
  const displayName = "Test User";
  const passwordHash = await bcrypt.hash(password, 10);

  const account = await prisma.account.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      displayName,
    },
  });

  console.log(`Test account created: ${account.email} (${account.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
