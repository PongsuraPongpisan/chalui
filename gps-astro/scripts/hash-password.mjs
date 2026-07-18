// Usage: node scripts/hash-password.mjs <username> <role> <password>
// Prints a ready-to-paste SQL insert statement with the bcrypt hash.
import bcrypt from 'bcryptjs';

const [, , username, role, password] = process.argv;

if (!username || !role || !password) {
  console.log('Usage: node scripts/hash-password.mjs <username> <admin|contractor> <password>');
  process.exit(1);
}

if (role !== 'admin' && role !== 'contractor') {
  console.log('Role must be "admin" or "contractor"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nRun this in Supabase SQL Editor:\n');
console.log(
  `insert into app_users (username, password_hash, role) values ('${username}', '${hash}', '${role}');`
);
