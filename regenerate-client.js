const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🔄 Regenerating Prisma client...');
  
  // Change to backend directory
  process.chdir(path.join(__dirname));
  
  // Generate Prisma client
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('✅ Prisma client regenerated successfully!');
  
  // Create migration
  console.log('🔄 Creating migration...');
  execSync('npx prisma migrate dev --name update-order-status-enum', { stdio: 'inherit' });
  
  console.log('✅ Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
