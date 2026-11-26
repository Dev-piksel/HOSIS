const bcrypt = require('bcrypt')
const pool = require('../src/config/database')

const DEFAULT_ACCOUNTS = [
  { username: 'admin', password: 'Admin123456!', role: 'ADMIN' },
  { username: 'superadmin', password: 'Admin123456!', role: 'SUPER_ADMIN' },
  { username: 'frontoffice', password: 'FrontOffice123456!', role: 'FRONT_OFFICE' },
  { username: 'frontdesk', password: 'FrontOffice123456!', role: 'FRONT_OFFICE' },
  { username: 'finance.officer', password: 'Finance123456!', role: 'FINANCE' },
  { username: 'finofficer', password: 'FinanceOfficer2026!', role: 'FINANCE' },
  { username: 'officer', password: 'Finance123456!', role: 'OFFICER' },
  { username: 'finance.head', password: 'Head123456!', role: 'DEPARTMENT_HEAD' },
  { username: 'finhead', password: 'FinanceHead2026!', role: 'DEPARTMENT_HEAD' },
  { username: 'head', password: 'Head123456!', role: 'HEAD' },
  { username: 'financehead', password: 'Head123456!', role: 'DEPARTMENT_HEAD' },
  { username: 'sales.agent', password: 'Sales123456!', role: 'SALES_MARKETING' },
  { username: 'sales.manager', password: 'Sales123456!', role: 'SALES_MARKETING' },
  { username: 'hr', password: 'Hr123456!', role: 'HR' },
  { username: 'engineer', password: 'Engineer123456!', role: 'ENGINEERING' },
  { username: 'technician', password: 'Technician123456!', role: 'TECHNICIAN' },
]

async function main() {
  console.log('Resetting default development accounts in database...')
  for (const account of DEFAULT_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 12)
    await pool.query(
      `INSERT INTO users (username, password_hash, role, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             is_active = TRUE,
             session_version = users.session_version + 1,
             updated_at = NOW()`,
      [account.username.toLowerCase(), passwordHash, account.role],
    )
    console.log(`  ✓ Account [${account.role}] "${account.username}" -> Password: "${account.password}"`)
  }
  console.log('All development accounts are updated and ready to sign in.')
}

main()
  .catch((err) => {
    console.error('Failed to reset accounts:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
