const { Pool } = require('pg')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

async function seedConnectedSubsystems() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()

  try {
    console.log('Connecting and seeding data across all subsystems to Finance...')
    await client.query('BEGIN')

    // 1. Get user IDs
    const { rows: users } = await client.query('SELECT id, username, role FROM users;')
    const userMap = {}
    users.forEach(u => { userMap[u.username] = u.id })

    // 2. ENROLL / UPDATE HR EMPLOYEES ACROSS ALL 7 DEPARTMENTS
    console.log('1. Setting up HR Employees across all 7 departments...')
    const employees = [
      { id: 'EMP-FO-001', name: 'Sofia Mendoza', dept: 'frontdesk', pos: 'Front Desk Associate', rate: 750, contact: 'sofia.mendoza@grandhorizon.ph', user: userMap['frontdesk'] || userMap['frontoffice'] },
      { id: 'EMP-HK-33',  name: 'Maria Santos',  dept: 'housekeeping', pos: 'Senior Room Attendant', rate: 650, contact: 'maria.santos@grandhorizon.ph', user: userMap['housekeeper'] },
      { id: 'EMP-HK-34',  name: 'Roberto Diaz',  dept: 'housekeeping', pos: 'Housekeeping Floor Inspector', rate: 720, contact: 'roberto.diaz@grandhorizon.ph', user: userMap['inspector'] },
      { id: 'EMP-ENG-001', name: 'Miguel Torres', dept: 'maintenance', pos: 'Lead Maintenance Technician', rate: 850, contact: 'miguel.torres@grandhorizon.ph', user: userMap['technician'] },
      { id: 'EMP-ENG-002', name: 'Roberto Cruz', dept: 'maintenance', pos: 'Chief Facility Engineer', rate: 1200, contact: 'roberto.cruz@grandhorizon.ph', user: userMap['engineer'] },
      { id: 'EMP-FIN-001', name: 'Bianca Ramos', dept: 'finance', pos: 'Finance Officer', rate: 780, contact: 'bianca.ramos@grandhorizon.ph', user: userMap['finofficer'] || userMap['finance.officer'] },
      { id: 'EMP-FIN-002', name: 'Danielle Villanueva', dept: 'finance', pos: 'Finance Department Head', rate: 1500, contact: 'danielle.villanueva@grandhorizon.ph', user: userMap['finhead'] || userMap['finance.head'] },
      { id: 'EMP-SM-001', name: 'Camille Flores', dept: 'sales', pos: 'Corporate Sales Executive', rate: 800, contact: 'camille.flores@grandhorizon.ph', user: userMap['sales.agent'] },
      { id: 'EMP-HR-001', name: 'Patricia Lim', dept: 'hr', pos: 'Human Resources Generalist', rate: 750, contact: 'patricia.lim@grandhorizon.ph', user: userMap['hr'] },
    ]

    for (const e of employees) {
      if (e.user) {
        const { rows: existingUserEmp } = await client.query('SELECT id FROM hr_employees WHERE staff_user_id = $1;', [e.user])
        if (existingUserEmp.length > 0 && existingUserEmp[0].id !== e.id) {
          e.id = existingUserEmp[0].id
        }
      }

      await client.query(`
        INSERT INTO hr_employees (id, name, dept, pos, status, hired, rate, assignment, week, today, time_in, days, contact, staff_user_id)
        VALUES ($1, $2, $3, $4, 'Regular', CURRENT_DATE - 120, $5, 'Operations',
                '["AM","AM","AM","AM","AM","OFF","OFF"]', 'Present', '07:30', 11, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          dept = EXCLUDED.dept,
          pos = EXCLUDED.pos,
          rate = EXCLUDED.rate,
          days = EXCLUDED.days,
          contact = EXCLUDED.contact,
          staff_user_id = COALESCE(EXCLUDED.staff_user_id, hr_employees.staff_user_id);
      `, [e.id, e.name, e.dept, e.pos, e.rate, e.contact, e.user || null])
    }

    // 3. HR ATTENDANCE PERIODS (Daily Time Record / DTR Timesheets)
    console.log('2. Creating HR Attendance Periods / Timesheets for current payroll cycle...')
    for (const e of employees) {
      await client.query(`
        INSERT INTO hr_attendance_periods (employee_id, period_start, period_end, days_worked, overtime_hours, daily_rate)
        VALUES ($1, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE, 11, 4, $2)
        ON CONFLICT (employee_id, period_start, period_end) DO UPDATE SET
          days_worked = EXCLUDED.days_worked,
          overtime_hours = EXCLUDED.overtime_hours,
          daily_rate = EXCLUDED.daily_rate;
      `, [e.id, e.rate])
    }

    // 4. HR & FINANCE LEAVE REQUESTS
    console.log('3. Creating staff leave requests across HR and Finance...')
    const hkEmpId = employees.find(e => e.dept === 'housekeeping').id
    const engEmpId = employees.find(e => e.dept === 'maintenance').id
    const finEmpId = employees.find(e => e.dept === 'finance').id

    await client.query(`
      INSERT INTO hr_leave_requests (id, emp, type, start_date, end_date, days, status, reason, submitted_by)
      VALUES 
        ('LR-2026-001', $1, 'Vacation Leave', CURRENT_DATE + 3, CURRENT_DATE + 5, 3, 'Approved', 'Annual family reunion trip', $2),
        ('LR-2026-002', $3, 'Emergency Leave', CURRENT_DATE + 1, CURRENT_DATE + 1, 1, 'Approved', 'Home plumbing emergency repair', $4)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
    `, [hkEmpId, userMap['housekeeper'] || null, engEmpId, userMap['technician'] || null])

    await client.query(`
      INSERT INTO finance_leave_requests (request_code, employee_id, employee_name, department, leave_type, start_date, end_date, total_days, reason, status)
      VALUES
        ('FLR-2026-001', $1, 'Bianca Ramos', 'Finance & Accounting', 'Vacation Leave (VL)', CURRENT_DATE + 7, CURRENT_DATE + 9, 3, 'Pre-scheduled annual break after month-end closing', 'PENDING'),
        ('FLR-2026-002', 'EMP-FO-001', 'Sofia Mendoza', 'Front Desk', 'Sick Leave (SL)', CURRENT_DATE - 3, CURRENT_DATE - 2, 2, 'Severe flu under medical doctor advice', 'APPROVED')
      ON CONFLICT (request_code) DO NOTHING;
    `, [finEmpId])

    // 5. HOUSEKEEPING DAMAGE INCIDENTS (Connect to Finance Folio Billing)
    console.log('4. Connecting Housekeeping room damage findings to Finance Folio Billing...')
    await client.query(`
      INSERT INTO hk_charge_findings (
        public_reference, room_id, reservation_id, reservation_reference, category,
        description, estimated_amount, status, reported_by, reported_at
      ) VALUES (
        'HK-FIND-2026-001', 5, 4, 'RES-2026-1004', 'LINEN_LOSS',
        'Stained Egyptian Cotton Duvet and burn mark', 2500.00, 'FOR_FINANCE', $1, NOW() - INTERVAL '3 hours'
      ) ON CONFLICT DO NOTHING;
    `, [userMap['housekeeper'] || null])

    await client.query(`
      INSERT INTO hk_charge_findings (
        public_reference, room_id, reservation_id, reservation_reference, category,
        description, estimated_amount, status, reported_by, reported_at
      ) VALUES (
        'HK-FIND-2026-002', 9, 5, 'RES-2026-1005', 'DAMAGE',
        'Broken Crystal Bedside Lamp & shattered lampshade', 1800.00, 'FOR_FINANCE', $1, NOW() - INTERVAL '1 day'
      ) ON CONFLICT DO NOTHING;
    `, [userMap['inspector'] || null])

    await client.query(`
      INSERT INTO finance_hk_damages (
        incident_code, room_number, reservation_code, guest_name, damaged_item,
        damage_category, description, estimated_cost, billing_status, reported_by, reported_at
      ) VALUES
        ('INC-HK-2026-001', '201', 'RES-2026-1004', 'Isabella Cruz', 'Stained Egyptian Cotton Duvet', 'LINEN_LOSS', 'Stained Egyptian Cotton Duvet and burn mark', 2500.00, 'PENDING_BILLING', 'Maria Santos (Room Attendant)', NOW() - INTERVAL '3 hours'),
        ('INC-HK-2026-002', '301', 'RES-2026-1005', 'Liam Johnson', 'Broken Crystal Bedside Lamp', 'DAMAGE', 'Broken Crystal Bedside Lamp & shattered lampshade', 1800.00, 'PENDING_BILLING', 'Roberto Diaz (Inspector)', NOW() - INTERVAL '1 day')
      ON CONFLICT (incident_code) DO NOTHING;
    `)

    // 6. ENGINEERING WORK ORDERS & MAINTENANCE REIMBURSEMENTS
    console.log('5. Connecting Engineering Work Orders to Finance OpEx Vouchers...')
    await client.query(`
      INSERT INTO engineering.engineering_records (collection, record_id, payload)
      VALUES
        ('finance', 'WO-2026-ENG-089', '{"id":"WO-2026-ENG-089","date":"2026-11-20","type":"Equipment","description":"HVAC Chiller Compressor Overhaul & R134a Refrigerant Refill","amount":15000,"payee":"CoolTech Industrial Services Inc","status":"Unpaid","reference":"PO-ENG-2026-089"}'::jsonb),
        ('finance', 'WO-2026-ENG-092', '{"id":"WO-2026-ENG-092","date":"2026-11-22","type":"Facility","description":"Elevator Hydraulic Valve Replacement & Safety Sensor Testing","amount":8500,"payee":"Otis Elevator Philippines Inc","status":"Approved","reference":"PO-ENG-2026-092"}'::jsonb),
        ('finance', 'WO-2026-ENG-095', '{"id":"WO-2026-ENG-095","date":"2026-11-24","type":"Maintenance","description":"Commercial Kitchen Grease Trap Extraction & Steam Pipe Cleaning","amount":6200,"payee":"Sanitech Environmental Solutions","status":"Unpaid","reference":"PO-ENG-2026-095"}'::jsonb)
      ON CONFLICT (collection, record_id) DO UPDATE SET payload = EXCLUDED.payload;
    `)

    await client.query(`
      INSERT INTO finance_expenses (
        voucher_code, department, category, amount, status, approved_by,
        expense_date, work_order_id, engineering_record_id, expense_classification,
        approval_tier, notes
      ) VALUES
        ('VCH-ENG-2026-089', 'Engineering', 'HVAC Chiller Overhaul', 15000.00, 'PENDING', NULL, CURRENT_DATE - 4, 'WO-2026-ENG-089', 'WO-2026-ENG-089', 'OPEX', 'STANDARD', 'Scheduled biannual chiller overhaul'),
        ('VCH-ENG-2026-092', 'Engineering', 'Elevator Hydraulic Replacement', 8500.00, 'APPROVED', 'Danielle Villanueva (Finance Head)', CURRENT_DATE - 2, 'WO-2026-ENG-092', 'WO-2026-ENG-092', 'OPEX', 'AUTO', 'Preventative elevator safety certification maintenance')
      ON CONFLICT (voucher_code) DO NOTHING;
    `)

    // 7. SALES & MARKETING DEALS (Milestone Invoicing)
    console.log('6. Connecting Sales & Marketing Deals to Milestone Invoicing...')
    const todayStr = new Date().toISOString().slice(0, 10)
    await client.query(`
      INSERT INTO sales_marketing_records (kind, id, details)
      VALUES
        ('sale', 'SALE-2026-001', '{"customer":"Mabuhay Tech Solutions Corp","item":"Annual Tech Summit 3-Day Conference & Banquet","amount":180000,"payment":"Pending","date":"${todayStr}"}'::jsonb),
        ('sale', 'SALE-2026-002', '{"customer":"Apex Global Logistics Inc","item":"Executive Board Strategic Retreat Package","amount":75000,"payment":"Pending","date":"${todayStr}"}'::jsonb),
        ('sale', 'SALE-2026-003', '{"customer":"San Miguel International Trading Corp","item":"Year-End Corporate Gala & 50 Suite Booking","amount":250000,"payment":"Pending","date":"${todayStr}"}'::jsonb)
      ON CONFLICT (kind, id) DO NOTHING;
    `)

    await client.query(`
      INSERT INTO finance_sales_records (
        deal_code, client_name, package_name, package_category, contract_amount,
        milestone_stage, payment_term_days, event_date, sales_rep, status, notes
      ) VALUES
        ('DEAL-SM-2026-001', 'Mabuhay Tech Solutions Corp', 'Annual Tech Summit (Grand Ballroom + 40 Rooms)', 'CORPORATE', 180000.00, 'DEPOSIT_20', 30, CURRENT_DATE + 21, 'Camille Flores', 'CONFIRMED', 'Milestone eligible: 20% Deposit (₱36,000), 50% Midterm (₱90,000), 30% Balance (₱54,000)'),
        ('DEAL-SM-2026-002', 'Apex Global Logistics Inc', 'Executive Board Strategic Retreat Package', 'CORPORATE', 75000.00, 'DEPOSIT_20', 15, CURRENT_DATE + 14, 'Camille Flores', 'CONFIRMED', '20% initial deposit invoice pending release'),
        ('DEAL-SM-2026-003', 'San Miguel International Trading Corp', 'Year-End Corporate Gala & 50 Suite Booking', 'CORPORATE', 250000.00, 'DEPOSIT_20', 30, CURRENT_DATE + 30, 'Camille Flores', 'CONFIRMED', 'Full corporate banquet contract')
      ON CONFLICT (deal_code) DO NOTHING;
    `)

    // 8. CITY LEDGER CORPORATE RECEIVABLES (30 / 60 / 90+ Days Aging)
    console.log('7. Populating City Ledger Accounts Receivable with aging buckets...')
    const corporateDebtors = [
      { code: 'INV-CORP-2026-001', name: 'Metro Pacific Health Systems Corp', amount: 48500, paid: 15000, daysAgo: 18 },
      { code: 'INV-CORP-2026-002', name: 'Manila Maritime Freight Services Inc', amount: 62000, paid: 0, daysAgo: 42 },
      { code: 'INV-CORP-2026-003', name: 'Airlines Cabin Crew Association', amount: 89400, paid: 25000, daysAgo: 74 },
      { code: 'INV-CORP-2026-004', name: 'Legacy Horizon Aviation Guild', amount: 115000, paid: 15000, daysAgo: 110 },
    ]

    for (const d of corporateDebtors) {
      await client.query(`
        INSERT INTO finance_invoices (
          invoice_code, guest_name, invoice_type, subtotal, vat, total_amount,
          paid_amount, balance_due, status, issue_date, due_date
        ) VALUES (
          $1, $2, 'CORPORATE', $3 * 0.88, $3 * 0.12, $3,
          $4, $3 - $4, CASE WHEN $4 = 0 THEN 'ISSUED' ELSE 'PART_PAID' END,
          CURRENT_DATE - INTERVAL '${d.daysAgo} days', CURRENT_DATE - INTERVAL '${d.daysAgo} days'
        ) ON CONFLICT (invoice_code) DO NOTHING;
      `, [d.code, d.name, d.amount, d.paid])
    }

    // 9. REAL PAYROLL RECORDS (Pre-computed for Front Office, Housekeeping, Engineering)
    console.log('8. Pre-computing recent payroll disbursements...')
    const payrollRows = [
      {
        code: 'PAY-2026-11-001', empId: 'EMP-FO-001', name: 'Sofia Mendoza', dept: 'Front Office', role: 'Front Desk Associate',
        regH: 88, otH: 4, basic: 8250, otPay: 468.75, gross: 8718.75, tax: 250, sss: 405, phil: 218, pagibig: 100,
        ded: 973, net: 7745.75, status: 'DISBURSED'
      },
      {
        code: 'PAY-2026-11-002', empId: hkEmpId, name: 'Maria Santos', dept: 'Housekeeping', role: 'Senior Room Attendant',
        regH: 96, otH: 6, basic: 7800, otPay: 609.38, gross: 8409.38, tax: 200, sss: 382, phil: 210, pagibig: 100,
        ded: 892, net: 7517.38, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-003', empId: engEmpId, name: 'Miguel Torres', dept: 'Engineering', role: 'Maintenance Technician',
        regH: 96, otH: 8, basic: 10200, otPay: 1062.50, gross: 11262.50, tax: 400, sss: 450, phil: 250, pagibig: 100,
        ded: 1200, net: 10062.50, status: 'PENDING'
      }
    ]

    for (const p of payrollRows) {
      const disbursedAt = p.status === 'DISBURSED' ? new Date() : null
      await client.query(`
        INSERT INTO finance_payroll (
          payroll_code, employee_id, employee_name, department, role_title,
          regular_hours, overtime_hours, basic_pay, overtime_pay, gross_pay,
          withholding_tax, sss_deduction, philhealth_deduction, pagibig_deduction,
          total_deductions, net_payable, allowances, other_deductions,
          status, period_start, period_end, created_at, disbursed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, 0, 0,
          $17, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE, NOW(), $18
        ) ON CONFLICT (payroll_code) DO NOTHING;
      `, [p.code, p.empId, p.name, p.dept, p.role, p.regH, p.otH, p.basic, p.otPay, p.gross, p.tax, p.sss, p.phil, p.pagibig, p.ded, p.net, p.status, disbursedAt])
    }

    await client.query('COMMIT')
    console.log('\n🎉 ALL SUBSYSTEMS ARE NOW LIVE AND INTERCONNECTED WITH FINANCE!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Failed to seed connected subsystem data:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seedConnectedSubsystems()
