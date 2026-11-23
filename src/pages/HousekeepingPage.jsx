import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { formatCurrency, formatDate, todayStr, ROOM_TYPES } from '../data/initialData';

export default function HousekeepingPage() {
  const {
    rooms,
    bookings,
    markClean,
    setRoomStatus,
    maintenanceLogs,
    reportMaintenance,
    resolveMaintenance,
  } = useHotel();
  const { hasRole } = useAuth();
  const { toast } = useToast();

  const isOwnerOrReception = hasRole(['owner', 'reception']);
  const today = todayStr();

  // Modal / Form state for Reporting Issue
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    roomId: rooms[0]?.id || '101',
    issue: '',
    priority: 'normal',
    closeRoom: false,
  });

  // Modal for Resolving Issue
  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    resolutionNote: '',
    cost: '',
  });

  // Collapsible toggle for resolved issues
  const [showResolvedHistory, setShowResolvedHistory] = useState(false);


  // Summary counts
  const cleaningRooms = useMemo(() => rooms.filter(r => r.status === 'cleaning'), [rooms]);
  const maintenanceRooms = useMemo(() => rooms.filter(r => r.status === 'maintenance'), [rooms]);
  const openIssues = useMemo(() => {
    return (maintenanceLogs || [])
      .filter(l => l.status === 'open')
      .sort((a, b) => {
        const pOrder = { high: 0, normal: 1, low: 2 };
        return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1) || (b.reportedAt || '').localeCompare(a.reportedAt || '');
      });
  }, [maintenanceLogs]);

  const resolvedIssues = useMemo(() => {
    return (maintenanceLogs || [])
      .filter(l => l.status === 'resolved')
      .sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || ''))
      .slice(0, 30);
  }, [maintenanceLogs]);

  const checkingOutToday = useMemo(() => {
    return (bookings || []).filter(b => b.status === 'checked_in' && b.checkOut === today);
  }, [bookings, today]);

  // Handle Mark Clean
  const handleMarkClean = (roomId, roomNumber) => {
    markClean(roomId);
    toast(`✅ ຫ້ອງ ${roomNumber || roomId} ອະນາໄມຮຽບຮ້ອຍແລ້ວ (ພ້ອມຂາຍ)`, 'success');
  };

  // Handle Open Room from Maintenance
  const handleReopenRoom = (roomId, roomNumber) => {
    setRoomStatus(roomId, 'cleaning', 'ເປີດຂາຍຄືນ ໃຫ້ອະນາໄມກ່ອນ');
    toast(`🔄 ເປີດຫ້ອງ ${roomNumber || roomId} ຄືນແລ້ວ (ສະຖານະລໍອະນາໄມ)`, 'info');
  };

  // Submit Report Issue
  const handleSubmitReport = (e) => {
    e.preventDefault();
    if (!reportForm.issue.trim()) {
      toast('ກະລຸນາລະບຸບັນຫາທີ່ພົບ', 'warning');
      return;
    }
    reportMaintenance({
      roomId: reportForm.roomId,
      issue: reportForm.issue.trim(),
      priority: reportForm.priority,
      closeRoom: reportForm.closeRoom,
    });
    toast(`🛠️ ບັນທຶກການແຈ້ງສ້ອມແປງຫ້ອງ ${reportForm.roomId} ສຳເລັດ`, 'success');
    setShowReportModal(false);
    setReportForm({
      roomId: rooms[0]?.id || '101',
      issue: '',
      priority: 'normal',
      closeRoom: false,
    });
  };

  // Submit Resolve Issue
  const handleSubmitResolve = (e) => {
    e.preventDefault();
    if (!resolvingIssue) return;
    resolveMaintenance(
      resolvingIssue.id,
      resolveForm.resolutionNote.trim(),
      Number(resolveForm.cost) || 0
    );
    toast(`✅ ບັນທຶກສ້ອມແປງຫ້ອງ ${resolvingIssue.roomId} ສຳເລັດ`, 'success');
    setResolvingIssue(null);
    setResolveForm({ resolutionNote: '', cost: '' });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="section-title">🧹 ລະບົບແມ່ບ້ານ &amp; ສ້ອມແປງ (Housekeeping &amp; Maintenance)</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            ຕິດຕາມຫ້ອງລໍອະນາໄມ, ແຈ້ງບັນຫາອຸປະກອນເປ່ເພ ແລະ ບັນທຶກການສ້ອມແປງ
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowReportModal(true)}>
          🛠️ ແຈ້ງບັນຫາ / ສ້ອມແປງ
        </button>
      </div>

      {/* Summary Chips */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderTop: '3px solid #a855f7' }}>
          <div className="stat-label">🟣 ຫ້ອງລໍອະນາໄມ (Cleaning)</div>
          <div className="stat-value" style={{ color: '#a855f7' }}>{cleaningRooms.length} ຫ້ອງ</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ແຂກອອກແລ້ວ ລໍຖ້າທຳຄວາມສະອາດ
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div className="stat-label">🚪 ຈະ Check-out ມື້ນີ້</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{checkingOutToday.length} ຫ້ອງ</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ແຂກມີກຳນົດອອກມື້ນີ້ ({today})
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-label">⚠️ ບັນຫາທີ່ແຈ້ງຄ້າງ (Open Issues)</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{openIssues.length} ລາຍການ</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {openIssues.filter(i => i.priority === 'high').length} ລາຍການດ່ວນ
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid #64748b' }}>
          <div className="stat-label">🛠️ ຫ້ອງປິດສ້ອມແປງ (Maintenance)</div>
          <div className="stat-value" style={{ color: '#64748b' }}>{maintenanceRooms.length} ຫ້ອງ</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ປິດບໍ່ໃຫ້ຂາຍຈົນກວ່າຈະສ້ອມແລ້ວ
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Cleaning Rooms, Right = Maintenance Issues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* LEFT COLUMN: Cleaning Tasks */}
        <div>
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🟣 ຫ້ອງທີ່ຕ້ອງອະນາໄມ ({cleaningRooms.length})
              </h3>
            </div>

            {cleaningRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✨</div>
                <div style={{ fontWeight: 700, color: '#10b981' }}>ທຸກຫ້ອງອະນາໄມຮຽບຮ້ອຍແລ້ວ!</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>ບໍ່ມີຫ້ອງຄ້າງອະນາໄມໃນເວລານີ້</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cleaningRooms.map(rm => (
                  <div
                    key={rm.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid #c084fc',
                      borderRadius: 'var(--radius)',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ຫ້ອງ {rm.number}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          {ROOM_TYPES[rm.type] || rm.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        ຊັ້ນ {rm.floor} • ຄວາມຈຸ {rm.capacity} ທ່ານ
                      </div>
                      {rm.statusNote && (
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
                          📌 ໝາຍເຫດ: {rm.statusNote}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-success"
                      style={{ padding: '10px 18px', fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                      onClick={() => handleMarkClean(rm.id, rm.number)}
                    >
                      ✅ ອະນາໄມແລ້ວ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rooms Checking Out Today Alert */}
          {checkingOutToday.length > 0 && (
            <div className="card" style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fcd34d' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#b45309', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔔 ແຂກມີກຳນົດອອກມື້ນີ້ ({checkingOutToday.length} ຫ້ອງ):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {checkingOutToday.map(b => {
                  const rm = rooms.find(r => r.id === b.roomId);
                  return (
                    <span
                      key={b.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #f59e0b',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#92400e',
                      }}
                    >
                      ຫ້ອງ {rm?.number || b.roomId} ({b.guestName})
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Maintenance Rooms */}
          {maintenanceRooms.length > 0 && (
            <div className="card" style={{ padding: '20px', marginTop: '20px', borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444', marginBottom: '12px' }}>
                🛠️ ຫ້ອງປິດສ້ອມແປງ ({maintenanceRooms.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {maintenanceRooms.map(rm => (
                  <div
                    key={rm.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      padding: '12px',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>ຫ້ອງ {rm.number}</div>
                      <div style={{ fontSize: '0.78rem', color: '#ef4444' }}>
                        {rm.statusNote || 'ກຳລັງສ້ອມແປງ'}
                      </div>
                    </div>
                    {isOwnerOrReception && (
                      <button
                        className="btn btn-outline-primary btn-xs"
                        onClick={() => handleReopenRoom(rm.id, rm.number)}
                      >
                        🔓 ເປີດຂາຍຄືນ
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Maintenance Issues */}
        <div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ ລາຍການແຈ້ງສ້ອມແປງທີ່ຄ້າງ ({openIssues.length})
              </h3>
            </div>

            {openIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                <div style={{ fontWeight: 700, color: '#10b981' }}>ບໍ່ມີບັນຫາຄ້າງສ້ອມແປງ!</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>ອຸປະກອນທຸກຫ້ອງພ້ອມໃຊ້ງານສົມບູນ</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {openIssues.map(issue => {
                  const rm = rooms.find(r => r.id === issue.roomId);
                  const isHigh = issue.priority === 'high';
                  return (
                    <div
                      key={issue.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: `1px solid ${isHigh ? '#ef4444' : 'var(--border)'}`,
                        borderLeft: `4px solid ${isHigh ? '#ef4444' : issue.priority === 'low' ? '#10b981' : '#f59e0b'}`,
                        borderRadius: 'var(--radius)',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                            ຫ້ອງ {rm?.number || issue.roomId}
                          </span>
                          <span
                            style={{
                              marginLeft: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isHigh ? '#fee2e2' : '#fef3c7',
                              color: isHigh ? '#b91c1c' : '#b45309',
                            }}
                          >
                            {issue.priority === 'high' ? '🚨 ດ່ວນທີ່ສຸດ' : issue.priority === 'low' ? '🟢 ປົກກະຕິ' : '🟡 ປານກາງ'}
                          </span>
                          {issue.closedRoom && (
                            <span style={{ marginLeft: '6px', fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                              🔒 ປິດຫ້ອງ
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formatDate(issue.reportedAt?.slice(0, 10))}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 600 }}>
                        {issue.issue}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>ແຈ້ງໂດຍ: {issue.reportedBy || '-'}</span>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-xs"
                          onClick={() => {
                            setResolvingIssue(issue);
                            setResolveForm({ resolutionNote: '', cost: '' });
                          }}
                        >
                          ✅ ໝາຍວ່າສ້ອມແລ້ວ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved History Collapsible */}
          <div className="card" style={{ padding: '16px', marginTop: '20px' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowResolvedHistory(v => !v)}
            >
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                📋 ປະຫວັດການສ້ອມແປງທີ່ສຳເລັດ ({resolvedIssues.length} ລາຍການ)
              </div>
              <span style={{ fontSize: '0.85rem' }}>{showResolvedHistory ? '▲ ຫຍໍ້' : '▼ ເບິ່ງ'}</span>
            </div>

            {showResolvedHistory && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resolvedIssues.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    ຍັງບໍ່ມີປະຫວັດການສ້ອມແປງ
                  </div>
                ) : (
                  resolvedIssues.map(log => (
                    <div
                      key={log.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.82rem',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>ຫ້ອງ {log.roomId}: {log.issue}</span>
                        <span style={{ color: '#10b981' }}>✓ ສຳເລັດ</span>
                      </div>
                      {log.resolutionNote && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          ວິທີແກ້ໄຂ: {log.resolutionNote}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px' }}>
                        <span>ສ້ອມໂດຍ: {log.resolvedBy || '-'} ({formatDate(log.resolvedAt?.slice(0, 10))})</span>
                        {log.cost > 0 && <span style={{ fontWeight: 700, color: '#ef4444' }}>ຄ່າສ້ອມ: {formatCurrency(log.cost)}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Report Maintenance Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <span className="modal-title">🛠️ ແຈ້ງບັນຫາ / ສ້ອມແປງ</span>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitReport}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">ເລືອກຫ້ອງ <span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={reportForm.roomId}
                    onChange={e => setReportForm(p => ({ ...p, roomId: e.target.value }))}
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>ຫ້ອງ {r.number} ({ROOM_TYPES[r.type] || r.type})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">ບັນຫາທີ່ພົບ <span className="required">*</span></label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="ເຊັ່ນ: ແອບໍ່ເຢັນ, ນ້ຳຮົ່ວໃຕ້ອ່າງລ້າງໜ້າ, ຫຼອດໄຟຫ້ອງນ້ຳຂາດ..."
                    value={reportForm.issue}
                    onChange={e => setReportForm(p => ({ ...p, issue: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ລະດັບຄວາມດ່ວນ</label>
                  <select
                    className="form-select"
                    value={reportForm.priority}
                    onChange={e => setReportForm(p => ({ ...p, priority: e.target.value }))}
                  >
                    <option value="normal">🟡 ປົກກະຕິ (Normal)</option>
                    <option value="high">🚨 ດ່ວນທີ່ສຸດ (Urgent - ຕ້ອງສ້ອມທັນທີ)</option>
                    <option value="low">🟢 ຕ່ຳ (Low - ລໍຖ້າໄດ້)</option>
                  </select>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={reportForm.closeRoom}
                      onChange={e => setReportForm(p => ({ ...p, closeRoom: e.target.checked }))}
                    />
                    <span>🔒 ປິດຫ້ອງບໍ່ໃຫ້ຂາຍ (ຕັ້ງສະຖານະເປັນ Maintenance ທັນທີ)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowReportModal(false)}>ຍົກເລີກ</button>
                <button type="submit" className="btn btn-primary">✅ ສົ່ງລາຍງານສ້ອມແປງ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Maintenance Modal */}
      {resolvingIssue && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setResolvingIssue(null)}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <span className="modal-title">✅ ສ້ອມແປງສຳເລັດ: ຫ້ອງ {resolvingIssue.roomId}</span>
              <button className="modal-close" onClick={() => setResolvingIssue(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitResolve}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '14px', fontSize: '0.85rem' }}>
                  <strong>ບັນຫາທີ່ແຈ້ງ:</strong> {resolvingIssue.issue}
                </div>

                <div className="form-group">
                  <label className="form-label">ລາຍລະອຽດການແກ້ໄຂ</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="ເຊັ່ນ: ປ່ຽນຫຼອດໄຟໃໝ່ແລ້ວ, ລ້າງແອຮຽບຮ້ອຍ..."
                    value={resolveForm.resolutionNote}
                    onChange={e => setResolveForm(p => ({ ...p, resolutionNote: e.target.value }))}
                    autoFocus
                  />
                </div>

                {isOwnerOrReception && (
                  <div className="form-group">
                    <label className="form-label">ຄ່າໃຊ້ຈ່າຍໃນການສ້ອມ (₭ - ຖ້າມີ)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="0"
                      value={resolveForm.cost}
                      onChange={e => setResolveForm(p => ({ ...p, cost: e.target.value }))}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      * ຖ້າໃສ່ຄ່າໃຊ້ຈ່າຍ ລະບົບຈະບັນທຶກລົງຕາຕະລາງລາຍຈ່າຍ (Expenses) ໃຫ້ອັດຕະໂນມັດ
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setResolvingIssue(null)}>ຍົກເລີກ</button>
                <button type="submit" className="btn btn-success">💾 ບັນທຶກສຳເລັດ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
