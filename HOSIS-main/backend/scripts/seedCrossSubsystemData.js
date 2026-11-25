const { Pool } = require('pg')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

async function seedCrossSubsystemData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()

  try {
    console.log('Seeding rich interconnected data across all subsystems to Finance...')
    await client.query('BEGIN')

    // 1. Fetch HR employees
    const { rows: emps } = await client.query('SELECT id, name, dept, pos, rate, staff_user_id FROM hr_employees;')
    const empMap = {}
    emps.forEach(e => { empMap[e.id] = e })

    // 2. ENROLL FULL STAFF DTR (Daily Time Records) with Time In, Time Out & Night Differentials
    console.log('1. Seeding Staff DTR & Night Differentials (hr_daily_attendance)...')
    const todayStr = new Date().toISOString().slice(0, 10)

    const dtrEntries = [
      // Front Office Night Audit (10:00 PM to 06:00 AM) -> 8 hrs Night Diff!
      {
        empId: 'EMP-FO-001', name: 'Sofia Mendoza', dept: 'Front Office', role: 'Front Desk Associate',
        date: todayStr, shift: 'Night Audit (Graveyard)', timeIn: '22:00:00', timeOut: '06:00:00',
        regH: 8.00, otH: 2.00, nightDiffH: 8.00, status: 'OVERTIME', post: 'Front Desk Reception & Night Audit',
        notes: 'Handled midnight corporate check-ins and day-end night audit roll.'
      },
      // Front Office Day Shift
      {
        empId: 'EMP-FO-001', name: 'Sofia Mendoza', dept: 'Front Office', role: 'Front Desk Associate',
        date: '2026-11-25', shift: 'Morning Shift', timeIn: '06:00:00', timeOut: '14:30:00',
        regH: 8.00, otH: 0.50, nightDiffH: 0.00, status: 'COMPLETED', post: 'Front Desk Counter 1',
        notes: 'Processed morning guest express checkouts.'
      },
      // Housekeeping Morning Shift
      {
        empId: 'EMP-HK-33', name: 'Maria Santos', dept: 'Housekeeping', role: 'Senior Room Attendant',
        date: todayStr, shift: 'Morning Shift', timeIn: '07:30:00', timeOut: '16:00:00',
        regH: 8.00, otH: 0.50, nightDiffH: 0.00, status: 'COMPLETED', post: 'Floors 2 & 3 Guest Corridors',
        notes: 'Completed 14 room turnover cleanings and linen restock.'
      },
      // Housekeeping Evening / Turn-down Shift (3 PM to 11 PM) -> 1 hr Night Diff (10 PM - 11 PM)
      {
        empId: 'EMP-HK-34', name: 'Roberto Diaz', dept: 'Housekeeping', role: 'Housekeeping Floor Inspector',
        date: todayStr, shift: 'Evening Turn-down Shift', timeIn: '15:00:00', timeOut: '23:30:00',
        regH: 8.00, otH: 0.50, nightDiffH: 1.50, status: 'OVERTIME', post: 'Floor 4 VIP Suite Inspections',
        notes: 'Evening turn-down service and verified Room 201 damage report.'
      },
      // Engineering Graveyard Standby Shift (10 PM to 6 AM) -> 8 hrs Night Diff!
      {
        empId: 'EMP-ENG-001', name: 'Miguel Torres', dept: 'Engineering & Maintenance', role: 'Lead Maintenance Technician',
        date: todayStr, shift: 'Graveyard Emergency Standby', timeIn: '22:00:00', timeOut: '06:00:00',
        regH: 8.00, otH: 1.00, nightDiffH: 8.00, status: 'OVERTIME', post: 'Central Mechanical & Chiller Plant',
        notes: 'Monitored chiller refrigerant cycle and elevator hydraulic pressure overnight.'
      },
      // Engineering Day Shift
      {
        empId: 'EMP-ENG-002', name: 'Roberto Cruz', dept: 'Engineering & Maintenance', role: 'Chief Facility Engineer',
        date: todayStr, shift: 'Morning Executive Shift', timeIn: '08:00:00', timeOut: '17:00:00',
        regH: 8.00, otH: 1.00, nightDiffH: 0.00, status: 'COMPLETED', post: 'Engineering Operations Desk',
        notes: 'Approved HVAC chiller compressor overhaul contractor deliverables.'
      },
      // Finance Day Shift
      {
        empId: 'EMP-FIN-001', name: 'Bianca Ramos', dept: 'Finance & Accounting', role: 'Finance Officer',
        date: todayStr, shift: 'General Accounting Shift', timeIn: '08:30:00', timeOut: '17:30:00',
        regH: 8.00, otH: 1.00, nightDiffH: 0.00, status: 'COMPLETED', post: 'Finance Office Counter',
        notes: 'Reconciled Front Office daily cashier postings and guest folio receipts.'
      },
      // Finance Department Head
      {
        empId: 'EMP-FIN-002', name: 'Danielle Villanueva', dept: 'Finance & Accounting', role: 'Finance Department Head',
        date: todayStr, shift: 'Executive Management Shift', timeIn: '08:00:00', timeOut: '17:00:00',
        regH: 8.00, otH: 0.00, nightDiffH: 0.00, status: 'COMPLETED', post: 'Finance Executive Suite',
        notes: 'Signed off on Q4 statutory returns and approved maintenance OpEx vouchers.'
      },
      // Sales & Marketing Field Shift
      {
        empId: 'EMP-SM-001', name: 'Camille Flores', dept: 'Sales & Marketing', role: 'Corporate Sales Executive',
        date: todayStr, shift: 'Corporate Client Relations', timeIn: '09:00:00', timeOut: '18:00:00',
        regH: 8.00, otH: 1.00, nightDiffH: 0.00, status: 'COMPLETED', post: 'Sales Lounge & Grand Ballroom',
        notes: 'Secured ₱250k San Miguel Year-End Corporate Banquet contract.'
      },
      // Human Resources Generalist
      {
        empId: 'EMP-HR-001', name: 'Patricia Lim', dept: 'Human Resources', role: 'Human Resources Generalist',
        date: todayStr, shift: 'HR Operations Shift', timeIn: '08:00:00', timeOut: '17:00:00',
        regH: 8.00, otH: 0.00, nightDiffH: 0.00, status: 'COMPLETED', post: 'HR Administration Office',
        notes: 'Processed bi-monthly attendance period ingestions and leave filings.'
      }
    ]

    for (const d of dtrEntries) {
      await client.query(`
        INSERT INTO hr_daily_attendance (
          employee_id, employee_name, department, role_title, duty_date,
          shift_name, time_in, time_out, regular_hours, overtime_hours,
          night_diff_hours, duty_status, duty_post, notes
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        ) ON CONFLICT (employee_id, duty_date) DO UPDATE SET
          time_in = EXCLUDED.time_in,
          time_out = EXCLUDED.time_out,
          regular_hours = EXCLUDED.regular_hours,
          overtime_hours = EXCLUDED.overtime_hours,
          night_diff_hours = EXCLUDED.night_diff_hours,
          duty_status = EXCLUDED.duty_status,
          duty_post = EXCLUDED.duty_post,
          notes = EXCLUDED.notes;
      `, [d.empId, d.name, d.dept, d.role, d.date, d.shift, d.timeIn, d.timeOut, d.regH, d.otH, d.nightDiffH, d.status, d.post, d.notes])
    }

    // 3. DEPARTMENT BUDGET REQUESTS (Maintenance, Housekeeping, Front Office, Sales, HR)
    console.log('2. Seeding Department Budget Requests (finance_budget_requests)...')
    const budgetRequests = [
      {
        code: 'BGR-ENG-2026-001', dept: 'Engineering & Maintenance', cat: 'CAPEX',
        title: 'Central Chiller Compressor Overhaul & R134a Refill',
        purpose: 'Scheduled biannual overhaul of primary central chiller compressor to maintain guest room climate control efficiency and energy standards.',
        reqAmt: 15000.00, appAmt: 15000.00, period: 'Nov 2026', status: 'APPROVED', priority: 'HIGH',
        by: 'Chief Roberto Cruz', at: 'CURRENT_DATE - 5', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 3',
        just: 'Required under DENR mechanical equipment safety compliance; prevents emergency HVAC failure.'
      },
      {
        code: 'BGR-ENG-2026-002', dept: 'Engineering & Maintenance', cat: 'CAPEX',
        title: 'Otis Elevator Hydraulic Valve Modernization & Cable Tensioning',
        purpose: 'Replacement of high-wear hydraulic safety valves and governor sensor calibration across guest elevator banks 1 and 2.',
        reqAmt: 38500.00, appAmt: 0.00, period: 'Q4 2026', status: 'PENDING_REVIEW', priority: 'HIGH',
        by: 'Chief Roberto Cruz', at: 'CURRENT_DATE - 2', revBy: null, revAt: null,
        just: 'Annual structural lift safety certification expiring on Dec 15, 2026.'
      },
      {
        code: 'BGR-ENG-2026-003', dept: 'Engineering & Maintenance', cat: 'OPEX',
        title: 'Emergency Generator 500kVA Semi-Annual Service & Fuel Reservoir',
        purpose: 'Full diesel engine filtration service, battery bank testing, and 2,000L low-sulfur diesel reserve top-up for storm preparedness.',
        reqAmt: 22500.00, appAmt: 22500.00, period: 'Nov 2026', status: 'DISBURSED', priority: 'CRITICAL',
        by: 'Miguel Torres', at: 'CURRENT_DATE - 8', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 7',
        just: 'Ensures 100% standby electrical power uninterrupted during typhoon season.'
      },
      {
        code: 'BGR-HK-2026-001', dept: 'Housekeeping', cat: 'SUPPLIES',
        title: 'Bulk Replenishment of 400-Thread Count Egyptian Cotton Duvets & Linens',
        purpose: 'Replacement of decommissioned room linens, guest towels, and damaged duvets across Deluxe and Suite room categories.',
        reqAmt: 45000.00, appAmt: 45000.00, period: 'Nov 2026', status: 'APPROVED', priority: 'MEDIUM',
        by: 'Maria Santos (Supervisor)', at: 'CURRENT_DATE - 6', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 4',
        just: 'Supports projected 95% occupancy during December peak holiday festivities.'
      },
      {
        code: 'BGR-HK-2026-002', dept: 'Housekeeping', cat: 'EQUIPMENT',
        title: 'Industrial HEPA Wet/Dry Commercial Vacuum Cleaners (4 Units)',
        purpose: 'Procurement of quiet-motor, hospital-grade allergen filtration vacuum cleaners for deep carpet sanitation.',
        reqAmt: 28000.00, appAmt: 0.00, period: 'Q4 2026', status: 'PENDING_REVIEW', priority: 'HIGH',
        by: 'Roberto Diaz', at: 'CURRENT_DATE - 1', revBy: null, revAt: null,
        just: 'Current 3rd-floor units are experiencing motor overheating; needed for floor turnovers.'
      },
      {
        code: 'BGR-FO-2026-001', dept: 'Front Office', cat: 'SUPPLIES',
        title: 'RFID Guest Keycards Bulk Stock & Magnetic Encoder Replacement',
        purpose: 'Replenishing 3,000 custom hotel-branded contactless RFID keycards and procuring 1 spare front desk card encoder.',
        reqAmt: 12500.00, appAmt: 12500.00, period: 'Nov 2026', status: 'DISBURSED', priority: 'HIGH',
        by: 'Nathan Mayo (Front Office)', at: 'CURRENT_DATE - 10', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 9',
        just: 'Keycard inventory was depleted to under 400 cards after major medical conference.'
      },
      {
        code: 'BGR-FO-2026-002', dept: 'Front Office', cat: 'FACILITY_UPGRADE',
        title: 'Lobby Digital Flight Arrival Display & Interactive Concierge Kiosk',
        purpose: 'Installation of twin 55-inch commercial display monitors in the main foyer streaming real-time NAIA airport flight departures.',
        reqAmt: 35000.00, appAmt: 0.00, period: 'Q4 2026', status: 'PENDING_REVIEW', priority: 'MEDIUM',
        by: 'Sofia Mendoza', at: 'CURRENT_DATE - 3', revBy: null, revAt: null,
        just: 'Enhances executive guest departure convenience and modernizes main reception ambiance.'
      },
      {
        code: 'BGR-SM-2026-001', dept: 'Sales & Marketing', cat: 'EVENT_SPONSORSHIP',
        title: 'Philippine Tourism & MICE Expo Grand Ballroom Sponsorship Booth',
        purpose: 'Gold Sponsor exhibition pavilion and corporate banquet tasting booth at SMX Convention Center.',
        reqAmt: 50000.00, appAmt: 50000.00, period: 'Nov 2026', status: 'APPROVED', priority: 'MEDIUM',
        by: 'Camille Flores', at: 'CURRENT_DATE - 12', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 10',
        just: 'Expected to generate over ₱1.2M in annual corporate retreat and conference bookings.'
      },
      {
        code: 'BGR-HR-2026-001', dept: 'Human Resources', cat: 'TRAINING',
        title: 'Annual Five-Star Hospitality Excellence Certification & CPR Training',
        purpose: 'Comprehensive 3-day customer delight, fire safety, and first-aid re-certification for all 70 hotel operations staff.',
        reqAmt: 25000.00, appAmt: 25000.00, period: 'Nov 2026', status: 'APPROVED', priority: 'HIGH',
        by: 'Patricia Lim', at: 'CURRENT_DATE - 14', revBy: 'Danielle Villanueva (Finance Head)', revAt: 'CURRENT_DATE - 12',
        just: 'Mandatory Department of Tourism (DOT) hotel star accreditation compliance.'
      }
    ]

    for (const b of budgetRequests) {
      await client.query(`
        INSERT INTO finance_budget_requests (
          request_code, department, category, title, purpose,
          requested_amount, approved_amount, fiscal_period, status, priority,
          requested_by, requested_at, reviewed_by, reviewed_at, justification
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, ${b.at}, $12, ${b.revAt ? b.revAt : 'NULL'}, $13
        ) ON CONFLICT (request_code) DO UPDATE SET
          title = EXCLUDED.title,
          purpose = EXCLUDED.purpose,
          requested_amount = EXCLUDED.requested_amount,
          approved_amount = EXCLUDED.approved_amount,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          reviewed_by = EXCLUDED.reviewed_by,
          reviewed_at = EXCLUDED.reviewed_at,
          justification = EXCLUDED.justification;
      `, [b.code, b.dept, b.cat, b.title, b.purpose, b.reqAmt, b.appAmt, b.period, b.status, b.priority, b.by, b.revBy, b.just])
    }

    // 4. COMPREHENSIVE ALL-SUBSYSTEM PAYROLL ROSTER (finance_payroll)
    console.log('3. Seeding All-Subsystem Payroll Records (finance_payroll)...')
    const fullPayroll = [
      {
        code: 'PAY-2026-11-FO1', empId: 'EMP-FO-001', name: 'Sofia Mendoza', dept: 'Front Office', role: 'Front Desk Associate',
        regH: 88, otH: 4, basic: 8250, otPay: 468.75, gross: 8718.75, tax: 250, sss: 405, phil: 218, pagibig: 100,
        ded: 973, net: 7745.75, status: 'DISBURSED'
      },
      {
        code: 'PAY-2026-11-HK1', empId: 'EMP-HK-33', name: 'Maria Santos', dept: 'Housekeeping', role: 'Senior Room Attendant',
        regH: 96, otH: 6, basic: 7800, otPay: 609.38, gross: 8409.38, tax: 200, sss: 382, phil: 210, pagibig: 100,
        ded: 892, net: 7517.38, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-HK2', empId: 'EMP-HK-34', name: 'Roberto Diaz', dept: 'Housekeeping', role: 'Housekeeping Floor Inspector',
        regH: 88, otH: 3, basic: 7920, otPay: 337.50, gross: 8257.50, tax: 210, sss: 390, phil: 206, pagibig: 100,
        ded: 906, net: 7351.50, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-ENG1', empId: 'EMP-ENG-001', name: 'Miguel Torres', dept: 'Engineering & Maintenance', role: 'Lead Maintenance Technician',
        regH: 96, otH: 8, basic: 10200, otPay: 1062.50, gross: 11262.50, tax: 400, sss: 450, phil: 250, pagibig: 100,
        ded: 1200, net: 10062.50, status: 'PENDING'
      },
      {
        code: 'PAY-2026-11-ENG2', empId: 'EMP-ENG-002', name: 'Roberto Cruz', dept: 'Engineering & Maintenance', role: 'Chief Facility Engineer',
        regH: 88, otH: 0, basic: 13200, otPay: 0.00, gross: 13200.00, tax: 650, sss: 500, phil: 280, pagibig: 100,
        ded: 1530, net: 11670.00, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-FIN1', empId: 'EMP-FIN-001', name: 'Bianca Ramos', dept: 'Finance & Accounting', role: 'Finance Officer',
        regH: 88, otH: 5, basic: 8580, otPay: 609.38, gross: 9189.38, tax: 300, sss: 420, phil: 230, pagibig: 100,
        ded: 1050, net: 8139.38, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-FIN2', empId: 'EMP-FIN-002', name: 'Danielle Villanueva', dept: 'Finance & Accounting', role: 'Finance Department Head',
        regH: 88, otH: 0, basic: 16500, otPay: 0.00, gross: 16500.00, tax: 950, sss: 600, phil: 320, pagibig: 100,
        ded: 1970, net: 14530.00, status: 'DISBURSED'
      },
      {
        code: 'PAY-2026-11-SM1', empId: 'EMP-SM-001', name: 'Camille Flores', dept: 'Sales & Marketing', role: 'Corporate Sales Executive',
        regH: 88, otH: 3, basic: 8800, otPay: 375.00, gross: 9175.00, tax: 300, sss: 420, phil: 230, pagibig: 100,
        ded: 1050, net: 8125.00, status: 'APPROVED'
      },
      {
        code: 'PAY-2026-11-HR1', empId: 'EMP-HR-001', name: 'Patricia Lim', dept: 'Human Resources', role: 'Human Resources Generalist',
        regH: 88, otH: 2, basic: 8250, otPay: 234.38, gross: 8484.38, tax: 220, sss: 400, phil: 215, pagibig: 100,
        ded: 935, net: 7549.38, status: 'APPROVED'
      }
    ]

    for (const p of fullPayroll) {
      const disbursedAt = p.status === 'DISBURSED' ? new Date() : null
      
      // Check if employee already has payroll for this period
      const { rows: existingPr } = await client.query(`
        SELECT id FROM finance_payroll 
        WHERE lower(btrim(employee_id)) = lower(btrim($1)) 
          AND period_start = CURRENT_DATE - INTERVAL '15 days' 
          AND period_end = CURRENT_DATE;
      `, [p.empId])

      if (existingPr.length > 0) {
        await client.query(`
          UPDATE finance_payroll SET
            employee_name = $1,
            department = $2,
            role_title = $3,
            regular_hours = $4,
            overtime_hours = $5,
            basic_pay = $6,
            overtime_pay = $7,
            gross_pay = $8,
            withholding_tax = $9,
            sss_deduction = $10,
            philhealth_deduction = $11,
            pagibig_deduction = $12,
            total_deductions = $13,
            net_payable = $14,
            status = $15,
            disbursed_at = $16
          WHERE id = $17;
        `, [p.name, p.dept, p.role, p.regH, p.otH, p.basic, p.otPay, p.gross, p.tax, p.sss, p.phil, p.pagibig, p.ded, p.net, p.status, disbursedAt, existingPr[0].id])
      } else {
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
          );
        `, [p.code, p.empId, p.name, p.dept, p.role, p.regH, p.otH, p.basic, p.otPay, p.gross, p.tax, p.sss, p.phil, p.pagibig, p.ded, p.net, p.status, disbursedAt])
      }
    }

    // 5. FRONT OFFICE CUSTOMER TRANSACTIONS & PAYMENTS (payments & invoices)
    console.log('4. Connecting Front Office Guest Payments & Invoices...')
    const guestPayments = [
      { invNum: 'INV-2026-1004', guestId: 4, room: '201', code: 'RES-2026-1004', amount: 20000, method: 'CARD', ref: 'TXN-CARD-90812' },
      { invNum: 'INV-2026-1005', guestId: 5, room: '301', code: 'RES-2026-1005', amount: 25000, method: 'CARD', ref: 'TXN-CARD-90815' },
      { invNum: 'INV-2026-1006', guestId: 6, room: '401', code: 'RES-2026-1006', amount: 18000, method: 'BANK_TRANSFER', ref: 'TXN-BDO-84729' },
      { invNum: 'INV-2026-1007', guestId: 34, room: '203', code: 'RES-AA647E45238D36BCCE2B7240', amount: 14000, method: 'OTHER', ref: 'GCASH-TXN-01928' },
    ]

    for (const gp of guestPayments) {
      const { rows: [inv] } = await client.query(`
        INSERT INTO invoices (invoice_number, guest_id, amount, status, notes, charge_type)
        VALUES ($1, $2, $3, 'PAID', 'Front Office Room Folio Settlement', 'LODGING')
        ON CONFLICT (invoice_number) DO UPDATE SET amount = EXCLUDED.amount, status = 'PAID'
        RETURNING id;
      `, [gp.invNum, gp.guestId, gp.amount])

      if (inv) {
        await client.query(`
          INSERT INTO payments (invoice_id, amount, payment_method, reference, paid_at)
          VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day')
          ON CONFLICT DO NOTHING;
        `, [inv.id, gp.amount, gp.method, gp.ref])
      }
    }

    await client.query('COMMIT')
    console.log('\n🎉 CROSS-SUBSYSTEM MASTER DATA SUCCESSFULLY INJECTED AND INTERCONNECTED!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error seeding cross-subsystem data:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seedCrossSubsystemData()
