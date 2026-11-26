import { useState, useEffect, useCallback } from 'react'
import { financeApi } from '../financeApi.js'

const DEPARTMENTS = [
  'Engineering & Maintenance',
  'Housekeeping',
  'Front Office',
  'Food & Beverage',
  'Sales & Marketing',
  'Human Resources',
  'Finance',
  'Administration',
]

const CATEGORIES = ['CAPEX', 'OPEX', 'REPAIR', 'SUPPLIES', 'EQUIPMENT', 'OTHER']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const STATUS_COLORS = {
  PENDING_REVIEW: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
  DISBURSED: 'blue',
}

function Badge({ status }) {
  const color = STATUS_COLORS[status] || 'gray'
  const label = (status || '').replace(/_/g, ' ')
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.03em',
        background:
          color === 'green' ? '#dcfce7' :
          color === 'orange' ? '#fff7ed' :
          color === 'red' ? '#fee2e2' :
          color === 'blue' ? '#eff6ff' : '#f1f5f9',
        color:
          color === 'green' ? '#15803d' :
          color === 'orange' ? '#c2410c' :
          color === 'red' ? '#dc2626' :
          color === 'blue' ? '#1d4ed8' : '#64748b',
      }}
    >
      {label}
    </span>
  )
}

function PriorityDot({ priority }) {
  const c = priority === 'CRITICAL' ? '#dc2626' : priority === 'HIGH' ? '#ea580c' : priority === 'MEDIUM' ? '#ca8a04' : '#64748b'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 6 }} />
}

function formatPHP(val) {
  return '₱' + Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BudgetRequestsView({ user, showToast }) {
  const isChecker = ['DEPARTMENT_HEAD', 'HEAD', 'FINANCE_HEAD', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
    user?.role?.toUpperCase()
  )

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // filters
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  // submit form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    department: DEPARTMENTS[0],
    category: 'REPAIR',
    priority: 'MEDIUM',
    title: '',
    purpose: '',
    requestedAmount: '',
    fiscalPeriod: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    roomNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // approval modal
  const [approving, setApproving] = useState(null)
  const [approveAmount, setApproveAmount] = useState('')
  const [approveNotes, setApproveNotes] = useState('')
  const [approvingSubmit, setApprovingSubmit] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await financeApi.subsystemBudgetRequests({
        department: deptFilter !== 'All' ? deptFilter : '',
        status: statusFilter !== 'All' ? statusFilter : '',
        search: search.trim(),
      })
      setRequests(res.data || res || [])
    } catch (err) {
      setError(err.message || 'Could not load budget requests.')
    } finally {
      setLoading(false)
    }
  }, [deptFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await financeApi.createBudgetRequest(form)
      showToast('✅ Budget request submitted successfully.')
      setShowForm(false)
      setForm({ department: DEPARTMENTS[0], category: 'REPAIR', priority: 'MEDIUM', title: '', purpose: '', requestedAmount: '', fiscalPeriod: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }), roomNumber: '' })
      load()
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'Failed to submit request.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecision(decision) {
    if (!approving) return
    setApprovingSubmit(true)
    try {
      await financeApi.decideBudgetRequest(approving.id, {
        decision,
        approvedAmount: approveAmount ? Number(approveAmount) : undefined,
        notes: approveNotes.trim() || undefined,
      })
      showToast(`✅ Request ${decision.toLowerCase()}.`)
      setApproving(null)
      setApproveAmount('')
      setApproveNotes('')
      load()
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'Action failed.'))
    } finally {
      setApprovingSubmit(false)
    }
  }

  // summary stats
  const pending = requests.filter(r => r.status === 'PENDING_REVIEW').length
  const approved = requests.filter(r => r.status === 'APPROVED' || r.status === 'DISBURSED').length
  const totalApproved = requests.filter(r => r.status === 'APPROVED' || r.status === 'DISBURSED').reduce((s, r) => s + Number(r.approvedAmount || 0), 0)
  const totalRequested = requests.reduce((s, r) => s + Number(r.requestedAmount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Budget Requests</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Departments submit maintenance, repair, and equipment funding requests here. Finance reviews and approves.
          </p>
        </div>
        <button
          className="button button-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowForm(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          New Request
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'Pending Review', value: pending, note: 'Awaiting Finance approval', color: '#f97316' },
          { label: 'Approved / Disbursed', value: approved, note: 'Cleared for use', color: '#22c55e' },
          { label: 'Total Requested', value: formatPHP(totalRequested), note: 'All periods', color: '#6366f1' },
          { label: 'Total Approved', value: formatPHP(totalApproved), note: 'Released budget', color: '#0ea5e9' },
        ].map(s => (
          <div key={s.label} className="surface" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="search-box"
          placeholder="Search by title, department, code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          style={{ flex: '1 1 220px', minWidth: 180 }}
        />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="select-filter">
          <option value="All">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-filter">
          <option value="All">All Statuses</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DISBURSED">Disbursed</option>
        </select>
      </div>

      {/* Table */}
      <div className="surface data-surface" style={{ overflow: 'auto' }}>
        {loading && <p style={{ padding: 24, color: '#64748b' }}>Loading…</p>}
        {!loading && error && <p style={{ padding: 24, color: '#dc2626' }}>{error}</p>}
        {!loading && !error && requests.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <p style={{ margin: 0, fontWeight: 600 }}>No budget requests found</p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Submit a new request using the button above.</p>
          </div>
        )}
        {!loading && !error && requests.length > 0 && (
          <table className="full-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department</th>
                <th>Title</th>
                <th>Room</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Period</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Date</th>
                {isChecker && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td><strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.requestCode}</strong></td>
                  <td>{r.department}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    {r.purpose && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.purpose}</div>}
                  </td>
                  <td>{r.roomNumber || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td><span style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>{r.category}</span></td>
                  <td><PriorityDot priority={r.priority} />{r.priority}</td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(r.requestedAmount)}</td>
                  <td style={{ color: r.approvedAmount > 0 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                    {r.approvedAmount > 0 ? formatPHP(r.approvedAmount) : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.fiscalPeriod}</td>
                  <td><Badge status={r.status} /></td>
                  <td style={{ fontSize: 12 }}>{r.requestedBy}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{formatDate(r.requestedAt)}</td>
                  {isChecker && (
                    <td>
                      {r.status === 'PENDING_REVIEW' && (
                        <button
                          className="small-action"
                          onClick={() => { setApproving(r); setApproveAmount(String(r.requestedAmount)); setApproveNotes('') }}
                        >
                          Review
                        </button>
                      )}
                      {r.status === 'APPROVED' && (
                        <button
                          className="small-action"
                          onClick={() => { setApproving(r); setApproveAmount(String(r.approvedAmount || r.requestedAmount)); setApproveNotes('') }}
                        >
                          Disburse
                        </button>
                      )}
                      {(r.status === 'REJECTED' || r.status === 'DISBURSED') && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Done</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Request Form Modal */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Submit Budget Request</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Request funds for maintenance, repairs, or equipment</p>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', fontSize: 20 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Department *</label>
                  <select className="select-filter" style={{ width: '100%' }} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Room / Area (optional)</label>
                  <input
                    className="search-box"
                    style={{ width: '100%' }}
                    placeholder="e.g. Room 302, Lobby, Kitchen"
                    value={form.roomNumber}
                    onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Request Title *</label>
                <input
                  className="search-box"
                  style={{ width: '100%' }}
                  placeholder="e.g. AC Unit Compressor Replacement Room 302"
                  value={form.title}
                  required
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Purpose / Details *</label>
                <textarea
                  className="search-box"
                  style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
                  placeholder="Describe what needs to be fixed, why, and expected scope of work…"
                  value={form.purpose}
                  required
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Category *</label>
                  <select className="select-filter" style={{ width: '100%' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Priority *</label>
                  <select className="select-filter" style={{ width: '100%' }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Fiscal Period *</label>
                  <input
                    className="search-box"
                    style={{ width: '100%' }}
                    placeholder="e.g. Nov 2026"
                    value={form.fiscalPeriod}
                    required
                    onChange={e => setForm(f => ({ ...f, fiscalPeriod: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>Requested Amount (₱) *</label>
                <input
                  className="search-box"
                  style={{ width: '100%' }}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={form.requestedAmount}
                  required
                  onChange={e => setForm(f => ({ ...f, requestedAmount: e.target.value }))}
                />
              </div>

              {form.category === 'REPAIR' && (
                <div style={{ padding: '10px 14px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 13, color: '#c2410c' }}>
                  💡 For room repairs: Finance will route this to Engineering's work order queue after approval.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Approve / Disburse Modal */}
      {approving && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setApproving(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {approving.status === 'APPROVED' ? 'Disburse Funds' : 'Review Request'}
                </h2>
                <code style={{ fontSize: 11, color: '#64748b' }}>{approving.requestCode}</code>
              </div>
              <button onClick={() => setApproving(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{approving.title}</div>
              <div style={{ color: '#64748b' }}>{approving.department}</div>
              {approving.roomNumber && <div style={{ color: '#64748b' }}>Room / Area: {approving.roomNumber}</div>}
              <div style={{ color: '#475569', marginTop: 6 }}>{approving.purpose}</div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>Requested: <span style={{ color: '#6366f1' }}>{formatPHP(approving.requestedAmount)}</span></div>
            </div>

            {approving.status !== 'APPROVED' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Approved Amount (₱)</label>
                <input
                  className="search-box"
                  style={{ width: '100%' }}
                  type="number"
                  min="0"
                  step="0.01"
                  value={approveAmount}
                  onChange={e => setApproveAmount(e.target.value)}
                  placeholder={String(approving.requestedAmount)}
                />
                <small style={{ color: '#94a3b8' }}>Leave unchanged to approve full amount</small>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes (optional)</label>
              <textarea
                className="search-box"
                style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                placeholder="Add a review comment or justification…"
                value={approveNotes}
                onChange={e => setApproveNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="button button-secondary" onClick={() => setApproving(null)}>Cancel</button>
              {approving.status === 'PENDING_REVIEW' && (
                <button
                  className="button button-secondary"
                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  disabled={approvingSubmit}
                  onClick={() => handleDecision('REJECTED')}
                >
                  {approvingSubmit ? '…' : 'Reject'}
                </button>
              )}
              {approving.status === 'PENDING_REVIEW' && (
                <button className="button button-primary" disabled={approvingSubmit} onClick={() => handleDecision('APPROVED')}>
                  {approvingSubmit ? 'Processing…' : 'Approve'}
                </button>
              )}
              {approving.status === 'APPROVED' && (
                <button className="button button-primary" disabled={approvingSubmit} onClick={() => handleDecision('DISBURSED')}>
                  {approvingSubmit ? 'Processing…' : 'Mark Disbursed'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
