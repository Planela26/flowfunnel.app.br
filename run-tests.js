require('dotenv').config({ path: '.env.local' });
require('child_process').execSync('npx tsx __tests__/affiliate-partial-refund.test.ts', { stdio: 'inherit' });
