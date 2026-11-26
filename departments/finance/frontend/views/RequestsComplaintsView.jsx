import { useState, useEffect, useCallback } from 'react'
import { findingLabel } from '@housekeeping/format.js'
import { financeApi } from '../financeApi.js'

function formatPHP(val) {
  return '₱' + Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function RequestsComplaintsView({ user, showToast }) {
  const isChecker = ['DEPARTMENT_HEAD', 'HEAD', 'FINANCE_HEAD', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
    user?.role?.toUpperCase()
  )

  const [activeTab, setActiveTab] = useState('findings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Data
  const [findings, setFindings] = useState([])
  const [subsystemDamages, setSubsystemDamages] = useState([])
  const [drafts, setDrafts] = useState({})
  const [processingId, setProcessingId] = useState(null)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [fRes, dRes] = await Promise.all([
        financeApi.housekeepingFindings().catch(() => ({ findings: [] })),
        financeApi.subsystemDamages({ search: search.trim() }).catch(() => ({ data: [] })),
      ])
      setFindings(fRes.findings || [])
      setSubsystemDamages(dRes.data || dRes || [])
    } catch (err) {
      setError(err.message || 'Could not load requests and complaints.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadData() }, [loadData])

  const setDraft = (id, key, val) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }))
  }

  async function handleDecideFinding(row, decision) {
    const draft = drafts[row.finding_id] || {}
    if (decision === 'APPROVE' && (!draft.amount || Number(draft.amount) <= 0)) {
      showToast?.('⚠️ Enter the approved charge amount before approving.')
      return
    }
    if (!draft.notes?.trim()) {
      showToast?.('⚠️ Enter decision notes for the record.')
      return
    }

    setProcessingId(row.finding_id)
    try {
      await financeApi.decideHousekeepingFinding(row.finding_id, {
        decision,
        amount: Number(draft.amount),
        notes: draft.notes.trim(),
      })
      showToast?.(`✅ ${row.public_reference} ${decision === 'APPROVE' ? 'charge approved & added to guest folio' : 'rejected / waived'}.`)
      loadData(true)
    } catch (err) {
      showToast?.('⚠️ ' + (err.message || 'Failed to update finding.'))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleBillDamage(damage, action) {
    setProcessingId(damage.id)
    try {
      if (action === 'BILL') {
        await financeApi.billHkDamage({
          damageId: damage.id,
          amount: Number(damage.estimatedCost || 0),
          notes: 'Billed to guest folio via Finance review',
        })
        showToast?.(`✅ ${damage.incidentCode} billed to folio.`)
      } else {
        showToast?.(`ℹ️ ${damage.incidentCode} marked as waived.`)
      }
      loadData(true)
    } catch (err) {
      showToast?.('⚠️ ' + (err.message || 'Action failed.'))
    } finally {
      setProcessingId(null)
    }
  }

  const pendingFindings = findings.filter(f => f.status === 'FOR_FINANCE').length
  const pendingDamages = subsystemDamages.filter(d => d.billingStatus === 'PENDING_BILLING').length
  const totalDamageValue = subsystemDamages.reduce((sum, d) => sum + Number(d.estimatedCost || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Guest Requests, Complaints &amp; Damage Claims</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Review guest incident reports, room damage claims, and decide financial restitution or waivers.
          </p>
        </div>
        <button className="button button-secondary" onClick={() => loadData()}>Refresh</button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div className="surface" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Pending HK Charge Decisions</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>{pendingFindings}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Awaiting Finance approval</div>
        </div>
        <div className="surface" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Pending Folio Billing</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1' }}>{pendingDamages}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Unbilled damage incidents</div>
        </div>
        <div className="surface" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Damage Value</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{formatPHP(totalDamageValue)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Reported property damage</div>
        </div>
        <div className="surface" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Incidents Logged</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0ea5e9' }}>{findings.length + subsystemDamages.length}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Cross-subsystem records</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0' }}>
        {[
          { id: 'findings', label: `⚠️ Housekeeping Findings (${findings.length})` },
          { id: 'subsystem', label: `📦 Room Damage Claims (${subsystemDamages.length})` },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 500,
              background: activeTab === t.id ? '#fff' : 'transparent',
              color: activeTab === t.id ? '#1e40af' : '#64748b',
              borderBottom: activeTab === t.id ? '2px solid #1e40af' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Housekeeping Verified Findings */}
      {activeTab === 'findings' && (
        <div className="surface data-surface" style={{ overflow: 'auto' }}>
          {loading && <p style={{ padding: 20, color: '#64748b' }}>Loading findings…</p>}
          {!loading && error && <p style={{ padding: 20, color: '#dc2626' }}>{error}</p>}
          {!loading && !error && findings.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0 }}>No pending Housekeeping charge findings</p>
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>All room findings are reviewed and clear.</p>
            </div>
          )}
          {!loading && !error && findings.length > 0 && (
            <table className="full-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Room / Stay</th>
                  <th>Finding Description</th>
                  <th>Estimate</th>
                  <th>Status</th>
                  <th>Finance Decision</th>
                </tr>
              </thead>
              <tbody>
                {findings.map(row => (
                  <tr key={row.finding_id}>
                    <td>
                      <strong>{row.public_reference}</strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(row.reported_at)}</div>
                    </td>
                    <td>
                      <strong>Room {row.room_number}</strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{row.reservation_reference || 'No stay linked'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{findingLabel(row)}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{row.description}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#dc2626' }}>
                      {row.estimated_amount ? formatPHP(row.estimated_amount) : '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: row.status === 'FOR_FINANCE' ? '#fff7ed' : '#f0fdf4',
                        color: row.status === 'FOR_FINANCE' ? '#c2410c' : '#15803d'
                      }}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {row.status === 'FOR_FINANCE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Final PHP amount"
                            className="search-box"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            value={drafts[row.finding_id]?.amount || ''}
                            onChange={e => setDraft(row.finding_id, 'amount', e.target.value)}
                          />
                          <input
                            placeholder="Decision notes (required)"
                            maxLength={500}
                            className="search-box"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            value={drafts[row.finding_id]?.notes || ''}
                            onChange={e => setDraft(row.finding_id, 'notes', e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="button button-primary"
                              style={{ padding: '3px 10px', fontSize: 11 }}
                              disabled={processingId === row.finding_id}
                              onClick={() => handleDecideFinding(row, 'APPROVE')}
                            >
                              Approve Charge
                            </button>
                            <button
                              className="button button-secondary"
                              style={{ padding: '3px 10px', fontSize: 11 }}
                              disabled={processingId === row.finding_id}
                              onClick={() => handleDecideFinding(row, 'REJECT')}
                            >
                              Waive / Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12 }}>
                          {row.final_amount ? <strong style={{ color: '#16a34a' }}>{formatPHP(row.final_amount)} · </strong> : ''}
                          <span>{row.finance_notes || row.front_office_notes || '—'}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Room Damage Claims */}
      {activeTab === 'subsystem' && (
        <div className="surface data-surface" style={{ overflow: 'auto' }}>
          {loading && <p style={{ padding: 20, color: '#64748b' }}>Loading damage claims…</p>}
          {!loading && subsystemDamages.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛋️</div>
              <p style={{ margin: 0 }}>No room damage claims reported</p>
            </div>
          )}
          {!loading && subsystemDamages.length > 0 && (
            <table className="full-table">
              <thead>
                <tr>
                  <th>Incident Code</th>
                  <th>Room</th>
                  <th>Guest / Reservation</th>
                  <th>Damaged Item</th>
                  <th>Category</th>
                  <th>Est. Cost</th>
                  <th>Status</th>
                  <th>Reported By</th>
                  <th>Date</th>
                  {isChecker && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {subsystemDamages.map(d => (
                  <tr key={d.id}>
                    <td><code style={{ fontSize: 11 }}>{d.incidentCode}</code></td>
                    <td><strong>Room {d.roomNumber}</strong></td>
                    <td>
                      <div>{d.guestName || '—'}</div>
                      <small style={{ color: '#64748b' }}>{d.reservationCode || ''}</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.damagedItem}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{d.description}</div>
                    </td>
                    <td><span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{d.damageCategory}</span></td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>{formatPHP(d.estimatedCost)}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: d.billingStatus === 'BILLED_TO_FOLIO' ? '#dcfce7' : d.billingStatus === 'WAIVED' ? '#f1f5f9' : '#fff7ed',
                        color: d.billingStatus === 'BILLED_TO_FOLIO' ? '#15803d' : d.billingStatus === 'WAIVED' ? '#64748b' : '#c2410c',
                      }}>
                        {d.billingStatus ? d.billingStatus.replace(/_/g, ' ') : 'PENDING'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{d.reportedBy || 'Staff'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDate(d.reportedAt)}</td>
                    {isChecker && (
                      <td>
                        {d.billingStatus === 'PENDING_BILLING' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="small-action"
                              disabled={processingId === d.id}
                              onClick={() => handleBillDamage(d, 'BILL')}
                            >
                              Bill to Folio
                            </button>
                            <button
                              className="small-action"
                              style={{ color: '#64748b' }}
                              disabled={processingId === d.id}
                              onClick={() => handleBillDamage(d, 'WAIVE')}
                            >
                              Waive
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
