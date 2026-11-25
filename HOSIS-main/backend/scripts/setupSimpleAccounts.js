const bcrypt = require('bcrypt')
const pool = require('../src/config/database')

const SIMPLE_PASSWORD = 'password123'

const SUBSYSTEM_ACCOUNTS = [
  // Super Admin & Admin
  { username: 'superadmin', role: 'SUPER_ADMIN', position: 'SUPERVISOR', firstName: 'Super', lastName: 'Administrator', email: 'superadmin@grandhorizon.ph' },
  { username: 'admin', role: 'ADMIN', position: 'SUPERVISOR', firstName: 'System', lastName: 'Administrator', email: 'admin@grandhorizon.ph' },

  // Front Office
  { username: 'frontoffice', role: 'FRONT_OFFICE', position: 'SUPERVISOR', firstName: 'Front', lastName: 'Office', email: 'frontoffice@grandhorizon.ph' },
  { username: 'frontdesk', role: 'FRONT_OFFICE', position: 'SUPERVISOR', firstName: 'Front', lastName: 'Desk', email: 'frontdesk@grandhorizon.ph' },

  // Finance & Accounting (Maker-Checker)
  { username: 'finhead', role: 'DEPARTMENT_HEAD', position: 'SUPERVISOR', firstName: 'Danielle', lastName: 'Villanueva', email: 'danielle.villanueva@grandhorizon.ph' },
  { username: 'finofficer', role: 'FINANCE', position: 'SUPERVISOR', firstName: 'Elena', lastName: 'Ramos', email: 'elena.ramos@grandhorizon.ph' },
  { username: 'finance.head', role: 'DEPARTMENT_HEAD', position: 'SUPERVISOR', firstName: 'Danielle', lastName: 'Villanueva', email: 'danielle.head@grandhorizon.ph' },
  { username: 'finance.officer', role: 'FINANCE', position: 'SUPERVISOR', firstName: 'Elena', lastName: 'Ramos', email: 'elena.officer@grandhorizon.ph' },

  // Housekeeping
  { username: 'housekeeper', role: 'HOUSEKEEPING', position: 'HOUSEKEEPER', firstName: 'Maria', lastName: 'Santos', email: 'housekeeper@grandhorizon.ph' },
  { username: 'inspector', role: 'HOUSEKEEPING', position: 'INSPECTOR', firstName: 'Roberto', lastName: 'Diaz', email: 'inspector@grandhorizon.ph' },

  // Engineering & Maintenance
  { username: 'engineer', role: 'ENGINEERING', position: 'SUPERVISOR', firstName: 'Chief', lastName: 'Engineer', email: 'engineer@grandhorizon.ph' },
  { username: 'technician', role: 'TECHNICIAN', position: 'TECHNICIAN', firstName: 'Lead', lastName: 'Technician', email: 'technician@grandhorizon.ph' },

  // Sales & Marketing
  { username: 'sales', role: 'SALES_MARKETING', position: 'SALES_HEAD', firstName: 'Sales', lastName: 'Director', email: 'sales@grandhorizon.ph' },
  { username: 'sales.manager', role: 'SALES_MARKETING', position: 'SALES_HEAD', firstName: 'Sales', lastName: 'Manager', email: 'sales.manager@grandhorizon.ph' },
  { username: 'sales.agent', role: 'SALES_MARKETING', position: 'SALES_STAFF', firstName: 'Sales', lastName: 'Agent', email: 'sales.agent@grandhorizon.ph' },

  // Human Resources
  { username: 'hr', role: 'HR', position: 'SUPERVISOR', firstName: 'Human', lastName: 'Resources', email: 'hr@grandhorizon.ph' },
]

async function run() {
  console.log(`Setting up simple password ("${SIMPLE_PASSWORD}") for all subsystem accounts...`)
  const passwordHash = await bcrypt.hash(SIMPLE_PASSWORD, 10)

  for (const acc of SUBSYSTEM_ACCOUNTS) {
    const res = await pool.query(
      `INSERT INTO users (username, password_hash, role, position, first_name, last_name, email, is_active, failed_logins, login_locked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 0, NULL)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             position = EXCLUDED.position,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             is_active = TRUE,
             failed_logins = 0,
             login_locked_at = NULL,
             session_version = users.session_version + 1,
             updated_at = NOW()
       RETURNING id, username, role, position`,
      [acc.username.toLowerCase(), passwordHash, acc.role, acc.position, acc.firstName, acc.lastName, acc.email]
    )

    const user = res.rows[0]

    // Ensure user does not have a forced password change requirement
    await pool.query('DELETE FROM hk_password_must_change WHERE user_id = $1', [user.id])

    console.log(`  ✓ Subsystem [${acc.role.padEnd(16)}] username: "${acc.username.padEnd(15)}" -> password: "${SIMPLE_PASSWORD}"`)
  }

  console.log('\nAll accounts configured successfully!')
}

run()
  .catch((err) => {
    console.error('Failed to configure accounts:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
