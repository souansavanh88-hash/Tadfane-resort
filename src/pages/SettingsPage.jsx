import RatePlansSection from '../components/settings/RatePlansSection';
import BackupSection from '../components/settings/BackupSection';
import NotifySection from '../components/settings/NotifySection';
import { useState, useRef, useEffect } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { ROOM_TYPES, AMENITIES_LIST, formatCurrency, formatDateTime, todayStr } from '../data/initialData';
import { getAuditLog, AUDIT_EVENT, AUDIT_ACTION_LABELS } from '../utils/audit';
import { exportToCsv } from '../utils/exportCsv';
import { validatePasswordStrength } from '../utils/security';

export default function SettingsPage() {
  const { rooms, updateRoom, addRoom, deleteRoom, hotelInfo, setHotelInfo, guestActivities, updateActivity } = useHotel();
  const { users, addUser, updateUser, deleteUser, currentUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('hotel');
  const [editRoom, setEditRoom] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editActivity, setEditActivity] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [hotelForm, setHotelForm] = useState({ ...hotelInfo });

  const tabs = [
    { key: 'hotel', label: '🏨 ຣີສອດ' },
    { key: 'rooms', label: '🛏️ ຈັດການຫ້ອງ' },
    { key: 'rates', label: '📅 ລາຄາລະດູການ' },
    { key: 'activities', label: '🪂 ຈັດການກິດຈະກຳ' },
    { key: 'users', label: '👤 ຜູ້ໃຊ້ງານ' },
    { key: 'backup', label: '💾 ສຳຮອງ & ກູ້ຄືນ' },
    { key: 'notify', label: '🔔 ແຈ້ງເຕືອນ' },
    { key: 'audit', label: '📜 ບັນທຶກການເຮັດວຽກ' },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hotel' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: '20px' }}>🏨 ຂໍ້ມູນຣີສອດ</div>
          <div className="form-group">
            <label className="form-label">ຊື່ຣີສອດ (ລາວ)</label>
            <input className="form-input" value={hotelForm.name || ''}
              onChange={e => setHotelForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">ຊື່ຣີສອດ (ອັງກິດ)</label>
            <input className="form-input" value={hotelForm.nameEn || ''}
              onChange={e => setHotelForm(p => ({ ...p, nameEn: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">ທີ່ຢູ່</label>
            <textarea className="form-textarea" rows={2} value={hotelForm.address || ''}
              onChange={e => setHotelForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ເບີໂທ</label>
              <input className="form-input" value={hotelForm.phone || ''}
                onChange={e => setHotelForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={hotelForm.email || ''}
                onChange={e => setHotelForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🟢 LINE ID (ສຳລັບລູກຄ້າຕິດຕໍ່ຈອງ)</label>
              <input className="form-input" value={hotelForm.lineContact || ''}
                placeholder="@tadfane ຫຼື line ID"
                onChange={e => setHotelForm(p => ({ ...p, lineContact: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">💬 WhatsApp</label>
              <input className="form-input" value={hotelForm.whatsapp || ''}
                placeholder="020 xxxx xxxx"
                onChange={e => setHotelForm(p => ({ ...p, whatsapp: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ເວລາ Check-in</label>
              <input className="form-input" type="time" value={hotelForm.checkInTime || '14:00'}
                onChange={e => setHotelForm(p => ({ ...p, checkInTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">ເວລາ Check-out</label>
              <input className="form-input" type="time" value={hotelForm.checkOutTime || '12:00'}
                onChange={e => setHotelForm(p => ({ ...p, checkOutTime: e.target.value }))} />
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '16px', marginTop: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '12px', color: 'var(--primary-light)' }}>
              🌊 ປະຫວັດຄວາມເປັນມາຂອງຣີສອດ (ແຍກແຕ່ລະພາສາ)
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇱🇦 ພາສາລາວ</label>
              <textarea className="form-textarea" rows={3} value={hotelForm.customHistoryLo || ''}
                onChange={e => setHotelForm(p => ({ ...p, customHistoryLo: e.target.value }))}
                placeholder="ປ້ອນປະຫວັດຄວາມເປັນມາເປັນພາສາລາວ..." />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇹🇭 ภาษาไทย</label>
              <textarea className="form-textarea" rows={3} value={hotelForm.customHistoryTh || ''}
                onChange={e => setHotelForm(p => ({ ...p, customHistoryTh: e.target.value }))}
                placeholder="ป้อนประวัติความเป็นมาเป็นภาษาไทย..." />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇺🇸 English</label>
              <textarea className="form-textarea" rows={3} value={hotelForm.customHistoryEn || ''}
                onChange={e => setHotelForm(p => ({ ...p, customHistoryEn: e.target.value }))}
                placeholder="Enter resort history in English..." />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇻🇳 Tiếng Việt</label>
              <textarea className="form-textarea" rows={3} value={hotelForm.customHistoryVi || ''}
                onChange={e => setHotelForm(p => ({ ...p, customHistoryVi: e.target.value }))}
                placeholder="Nhập lịch sử khu nghỉ dưỡng bằng tiếng Việt..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setHotelInfo(hotelForm);
            toast('ບັນທຶກຂໍ້ມູນຣີສອດສຳເລັດ! ✅', 'success');
          }}>
            💾 ບັນທຶກ
          </button>
        </div>
      )}

      {tab === 'rooms' && (
        <div>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title">🛏️ ຈັດການຫ້ອງທັງໝົດ</div>
              <div className="section-subtitle">{rooms.length} ຫ້ອງ</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddRoom(true)}>➕ ເພີ່ມຫ້ອງ</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ຫ້ອງ</th>
                  <th>ຊັ້ນ</th>
                  <th>ປະເພດ</th>
                  <th>ລາຄາ/ຄືນ</th>
                  <th>ຂະໜາດ</th>
                  <th>ຜູ້ເຂົ້າພັກ</th>
                  <th>ສະຖານະ</th>
                  <th>ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {[...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(room => (
                  <tr key={room.id}>
                    <td className="td-name">ຫ້ອງ {room.number}</td>
                    <td>ຊັ້ນ {room.floor}</td>
                    <td>{ROOM_TYPES[room.type]}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(room.price)}</td>
                    <td>{room.size}</td>
                    <td>👥 {room.capacity || 2} ທ່ານ</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {room.status}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setEditRoom({ ...room })}>
                        ✏️ ແກ້ໄຂ
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        if (room.status !== 'available' && room.status !== 'maintenance') {
                          toast('ບໍ່ສາມາດລຶບຫ້ອງທີ່ກຳລັງໃຊ້ງານ', 'error');
                          return;
                        }
                        if (window.confirm(`ລຶບຫ້ອງ ${room.number}?`)) {
                          deleteRoom(room.id);
                          toast(`ລຶບຫ້ອງ ${room.number} ສຳເລັດ`, 'success');
                        }
                      }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title">🪂 ຈັດການກິດຈະກຳ ແລະ ການບໍລິການ</div>
              <div className="section-subtitle">{guestActivities.length} ລາຍການ</div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ກິດຈະກຳ</th>
                  <th>ປະເພດ</th>
                  <th>ລາຄາບໍລິການ</th>
                  <th>ຮູບພາບ</th>
                  <th>ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {guestActivities.map(act => (
                  <tr key={act.id}>
                    <td className="td-name" style={{ fontSize: '1rem' }}>
                      <span style={{ marginRight: '8px', fontSize: '1.4rem' }}>{act.emoji}</span>
                      {act.label}
                    </td>
                    <td>
                      {act.price === null ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>☕ ການບໍລິການ / ພາບປະກອບ</span>
                      ) : act.id === 'resort' ? (
                        <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>🏨 ຫ້ອງພັກຣີສອດ</span>
                      ) : (
                        <span style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>
                          🎟️ ປີ້ / ກິດຈະກຳຈອງ {act.bookingEnabled === false && <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginLeft: '6px' }}>(🔴 ປິດຈອງ)</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {act.price === null ? 'ບໍ່ມີລາຄາ' : act.id === 'resort' ? 'ລາຄາຫ້ອງພັກ' : `${formatCurrency(act.price)} / ທ່ານ`}
                    </td>
                    <td>
                      {act.images && act.images.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {act.images.map((img, i) => (
                            <img key={i} src={img} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px' }} />
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ບໍ່ມີຮູບພາບ</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setEditActivity({ ...act })}>
                        ✏️ ແກ້ໄຂ & ໃສ່ຮູບພາບ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title">👤 ຈັດການຜູ້ໃຊ້ງານ</div>
              <div className="section-subtitle">{users.length} ຜູ້ໃຊ້</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>➕ ເພີ່ມຜູ້ໃຊ້</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชື່ຜູ້ໃຊ້</th>
                  <th>ຊື່</th>
                  <th>ສິດ</th>
                  <th>ສະຖານະ</th>
                  <th>ເບີໂທ</th>
                  <th>ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const roleLabels = { owner: '👨‍💼 ເຈົ້າຂອງ', reception: '👩‍💻 ພະນັກງານ', housekeeping: '🧹 ອະນາໄມ' };
                  return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{u.username}</td>
                      <td className="td-name">{u.name}</td>
                      <td>{roleLabels[u.role] || u.role}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: u.active !== false ? '#dcfce7' : '#fee2e2', color: u.active !== false ? '#15803d' : '#b91c1c' }}>
                          {u.active !== false ? '🟢 ໃຊ້ງານ' : '🔴 ປິດໃຊ້'}
                        </span>
                      </td>
                      <td>{u.phone || '-'}</td>
                      <td style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-outline-primary btn-sm" onClick={() => setEditUser({ ...u })}>
                          ✏️ ແກ້ໄຂ
                        </button>
                        {u.id !== currentUser?.id && (
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if (window.confirm(`ລຶບຜູ້ໃຊ້ ${u.username}?`)) {
                              try {
                                await deleteUser(u.id);
                                toast('ລຶບຜູ້ໃຊ້ສຳເລັດ', 'success');
                              } catch (err) {
                                toast(err.message, 'error');
                              }
                            }
                          }}>
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rates' && <RatePlansSection />}

      {tab === 'backup' && <BackupSection />}

      {tab === 'notify' && <NotifySection />}

      {tab === 'audit' && (
        <AuditLogSection />
      )}

      {/* Edit Room Modal */}
      {editRoom && (
        <RoomEditModal
          room={editRoom}
          onSave={(data) => {
            updateRoom(editRoom.id, data);
            toast('ອັບເດດຫ້ອງສຳເລັດ! ✅', 'success');
            setEditRoom(null);
          }}
          onClose={() => setEditRoom(null)}
        />
      )}

      {/* Add Room Modal */}
      {showAddRoom && (
        <RoomEditModal
          room={{ number: '', floor: 1, type: 'standard', price: 150000, size: '28 ຕ.ມ', capacity: 2, description: '', amenities: {}, status: 'available' }}
          isNew
          onSave={(data) => {
            addRoom(data);
            toast('ເພີ່ມຫ້ອງໃໝ່ສຳເລັດ! ✅', 'success');
            setShowAddRoom(false);
          }}
          onClose={() => setShowAddRoom(false)}
        />
      )}

      {/* Edit/Add User Modal */}
      {(editUser || showAddUser) && (
        <UserEditModal
          user={editUser || { username: '', password: '', name: '', phone: '', role: 'reception' }}
          isNew={!editUser}
          onSave={async (data) => {
            try {
              if (editUser) {
                await updateUser(editUser.id, data);
                toast('ອັບເດດຜູ້ໃຊ້ສຳເລັດ! ✅', 'success');
                setEditUser(null);
              } else {
                await addUser(data);
                toast('ເພີ່ມຜູ້ໃຊ້ສຳເລັດ! ✅', 'success');
                setShowAddUser(false);
              }
            } catch (err) {
              toast(err.message, 'error');
            }
          }}
          onClose={() => { setEditUser(null); setShowAddUser(false); }}
        />
      )}

      {/* Edit Activity Modal */}
      {editActivity && (
        <ActivityEditModal
          activity={editActivity}
          onSave={(data) => {
            updateActivity(editActivity.id, data);
            toast('ອັບເດດກິດຈະກຳສຳເລັດ! ✅', 'success');
            setEditActivity(null);
          }}
          onClose={() => setEditActivity(null)}
        />
      )}
    </div>
  );
}

function RoomEditModal({ room, isNew, onSave, onClose }) {
  const [form, setForm] = useState({ ...room });
  const fileInputRef = useRef();

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setAmenity = (k, v) => setForm(p => ({ ...p, amenities: { ...p.amenities, [k]: v } }));

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Max size bounds (e.g. 800px)
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // Compress quality to 0.7 JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setForm(p => ({ ...p, images: [...(p.images || []), compressedDataUrl] }));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{isNew ? '➕ ເພີ່ມຫ້ອງໃໝ່' : `✏️ ແກ້ໄຂ ຫ້ອງ ${room.number}`}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ໝາຍເລກຫ້ອງ <span className="required">*</span></label>
              <input className="form-input" value={form.number} onChange={e => set('number', e.target.value)} placeholder="101" />
            </div>
            <div className="form-group">
              <label className="form-label">ຊັ້ນ</label>
              <input className="form-input" type="number" min="1" value={form.floor} onChange={e => set('floor', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ປະເພດ</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ລາຄາ/ຄືນ (₭)</label>
              <input className="form-input" type="number" value={form.price} onChange={e => set('price', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ຂະໜາດ</label>
              <input className="form-input" value={form.size || ''} onChange={e => set('size', e.target.value)} placeholder="28 ຕ.ມ" />
            </div>
            <div className="form-group">
              <label className="form-label">ຈຳນວນຜູ້ເຂົ້າພັກ (👥 ທ່ານ)</label>
              <input className="form-input" type="number" min="1" value={form.capacity || 2} onChange={e => set('capacity', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">ຄຳອະທິບາຍ</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2} />
          </div>

          {/* Amenities */}
          <div className="form-group">
            <label className="form-label">ສິ່ງອຳນວຍຄວາມສະດວກ</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {AMENITIES_LIST.map(a => (
                <label key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.amenities?.[a.key]}
                    onChange={e => setAmenity(a.key, e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{a.icon} {a.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="form-group">
            <label className="form-label">ຮູບຫ້ອງ</label>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => fileInputRef.current?.click()}>
              📷 ເພີ່ມຮູບ
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
            {form.images && form.images.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {form.images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button
                      type="button"
                      onClick={() => set('images', form.images.filter((_, idx) => idx !== i))}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        background: 'var(--error)', color: 'white', border: 'none',
                        borderRadius: '50%', width: '18px', height: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '10px'
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>💾 ບັນທຶກ</button>
        </div>
      </div>
    </div>
  );
}

function UserEditModal({ user, isNew, onSave, onClose }) {
  const { usernameExists } = useAuth();
  const [form, setForm] = useState({ ...user });
  const [error, setError] = useState('');
  const set = (f, v) => {
    setForm(p => ({ ...p, [f]: v }));
    setError('');
  };

  const handleSave = () => {
    if (!form.name?.trim()) return setError('ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້');
    if (!form.username?.trim()) return setError('ກະລຸນາໃສ່ຊື່ Login (Username)');
    if (usernameExists(form.username, user?.id)) return setError('ຊື່ຜູ້ໃຊ້ນີ້ມີໃນລະບົບແລ້ວ');

    if (isNew) {
      if (!form.password) return setError('ກະລຸນາໃສ່ລະຫັດຜ່ານ');
      const pwErr = validatePasswordStrength(form.password, form.username);
      if (pwErr) return setError(pwErr);
    } else if (form.password) {
      const pwErr = validatePasswordStrength(form.password, form.username);
      if (pwErr) return setError(pwErr);
    }

    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <span className="modal-title">{isNew ? '➕ ເພີ່ມຜູ້ໃຊ້' : '✏️ ແກ້ໄຂຜູ້ໃຊ້'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>❌ {error}</div>}
          <div className="form-group">
            <label className="form-label">ຊື່ ແລະ ນາມສະກຸນ <span className="required">*</span></label>
            <input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="ຊື່-ນາມສະກຸນ" />
          </div>
          <div className="form-group">
            <label className="form-label">ຊື່ຜູ້ໃຊ້ (Username) <span className="required">*</span></label>
            <input className="form-input" value={form.username || ''} onChange={e => set('username', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">ລະຫັດຜ່ານ {isNew ? <span className="required">*</span> : '(ຫວ່າງ = ບໍ່ປ່ຽນ)'}</label>
            <input className="form-input" type="password" value={form.password || ''} onChange={e => set('password', e.target.value)} placeholder={isNew ? 'ຢ່າງໜ້ອຍ 8 ຕົວ (ອັກສອນ + ຕົວເລກ)' : '••••••••'} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ ແລະ ປະກອບມີທັງຕົວອັກສອນ + ຕົວເລກ
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">ສິດການໃຊ້ງານ</label>
            <select className="form-select" value={form.role || 'reception'} onChange={e => set('role', e.target.value)}>
              <option value="owner">👨‍💼 ເຈົ້າຂອງ</option>
              <option value="reception">👩‍💻 ພະນັກງານຕ້ອນຮັບ</option>
              <option value="housekeeping">🧹 ພະນັກງານອະນາໄມ</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ເບີໂທ</label>
            <input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="020 xxxx xxxx" />
          </div>
          {!isNew && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={e => set('active', e.target.checked)}
                />
                <span>ເປີດໃຊ້ງານບັນຊີນີ້ (Active)</span>
              </label>
            </div>
          )}
          {!isNew && form.password && (
            <div style={{ fontSize: '0.72rem', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', marginTop: '10px' }}>
              * ເມື່ອຣີເຊັດລະຫັດຜ່ານ ຜູ້ໃຊ້ນີ້ຈະຕ້ອງປ່ຽນລະຫັດໃໝ່ດ້ວຍຕົນເອງຕອນເຂົ້າລະບົບຄັ້ງຕໍ່ໄປ.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 ບັນທຶກ</button>
        </div>
      </div>
    </div>
  );
}

function AuditLogSection() {
  const [logs, setLogs] = useState(getAuditLog);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    const handler = () => setLogs(getAuditLog());
    window.addEventListener(AUDIT_EVENT, handler);
    return () => window.removeEventListener(AUDIT_EVENT, handler);
  }, []);

  const filteredLogs = logs.filter(l => {
    const matchSearch = !search ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.username?.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const handleExportCsv = () => {
    const headers = [
      { label: 'ວັນທີ-ເວລາ', accessor: (l) => formatDateTime(l.at) },
      { label: 'ຊື່ຜູ້ໃຊ້ (Username)', accessor: 'username' },
      { label: 'ຊື່ຜູ້ໃຊ້ງານ', accessor: 'userName' },
      { label: 'ບົດບາດ', accessor: (l) => l.role || '-' },
      { label: 'ການກະທຳ', accessor: (l) => AUDIT_ACTION_LABELS[l.action] || l.action },
      { label: 'ລາຍລະອຽດ', accessor: 'details' },
    ];
    exportToCsv(`hotel_audit_log_${todayStr()}`, headers, filteredLogs);
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div>
          <div className="section-title">📜 ບັນທຶກການເຮັດວຽກຂອງລະບົບ (Audit Log)</div>
          <div className="section-subtitle">
            ຕິດຕາມການເຂົ້າລະບົບ, ການຈອງ, ການປ່ຽນແປງຂໍ້ມູນ ແລະ ການເງິນທັງໝົດ ({filteredLogs.length} ລາຍການ)
          </div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={handleExportCsv} title="ດາວໂຫຼດບັນທຶກເປັນ Excel / CSV">
          📤 Export Audit Log (CSV)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          placeholder="🔍 ຄົ້ນຫາຊື່ຜູ້ໃຊ້, ຫ້ອງ, ລາຍລະອຽດ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '320px' }}
        />
        <select
          className="form-select"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ maxWidth: '240px' }}
        >
          <option value="all">— ທຸກການກະທຳ —</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📜</div>
            <div className="empty-state-text">ຍັງບໍ່ມີບັນທຶກ ຫຼື ບໍ່ພົບຂໍ້ມູນທີ່ຄົ້ນຫາ</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>ວັນທີ-ເວລາ</th>
                <th style={{ width: '150px' }}>ຜູ້ດຳເນີນການ</th>
                <th style={{ width: '160px' }}>ການກະທຳ</th>
                <th>ລາຍລະອຽດ</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(l.at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.userName || l.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      @{l.username} {l.role && `(${l.role})`}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      background: 'rgba(99,102,241,0.1)',
                      color: 'var(--primary-light)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}>
                      {AUDIT_ACTION_LABELS[l.action] || l.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    {l.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ActivityEditModal({ activity, onSave, onClose }) {
  const [form, setForm] = useState({ ...activity });
  const fileInputRef = useRef();

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Max size bounds (e.g. 800px)
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // Compress quality to 0.7 JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setForm(p => ({ ...p, images: [...(p.images || []), compressedDataUrl] }));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">✏️ ແກ້ໄຂກິດຈະກຳ: {activity.label}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">ຊື່ກິດຈະກຳ / ການບໍລິການ</label>
            <input className="form-input" value={form.label || ''} onChange={e => set('label', e.target.value)} />
          </div>

          {form.price !== null && form.id !== 'resort' && (
            <div className="form-group">
              <label className="form-label">ລາຄາບໍລິການ (₭)</label>
              <input className="form-input" type="number" value={form.price || ''} onChange={e => set('price', Number(e.target.value))} />
            </div>
          )}

          {form.id !== 'resort' && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={form.bookingEnabled !== false}
                  onChange={e => set('bookingEnabled', e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                />
                🟢 ເປີດໃຫ້ຈອງອອນລາຍ (Booking Enabled)
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '28px' }}>
                ຫາກປິດການຈອງ, ລະບົບຈະບໍ່ສະແດງປຸ່ມຈອງ ແຕ່ຈະສະແດງລາຍລະອຽດ ແລະ ພາບປະກອບບັນຍາກາດຢ່າງດຽວ.
              </p>
            </div>
          )}

          <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '12px', color: 'var(--primary-light)' }}>
              📝 ລາຍລະອຽດກິດຈະກຳ / ຂໍ້ມູນປະຫວັດ (ແຍກແຕ່ລະພາສາ)
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇱🇦 ພາສາລາວ</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.customDescriptionLo || ''}
                onChange={e => set('customDescriptionLo', e.target.value)}
                placeholder="ປ້ອນລາຍລະອຽດເປັນພາສາລາວ..."
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇹🇭 ภาษาไทย</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.customDescriptionTh || ''}
                onChange={e => set('customDescriptionTh', e.target.value)}
                placeholder="ป้อนรายละเอียดเป็นภาษาไทย..."
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇺🇸 English</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.customDescriptionEn || ''}
                onChange={e => set('customDescriptionEn', e.target.value)}
                placeholder="Enter description in English..."
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>🇻🇳 Tiếng Việt</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.customDescriptionVi || ''}
                onChange={e => set('customDescriptionVi', e.target.value)}
                placeholder="Nhập mô tả bằng tiếng Việt..."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ຮູບພາບປະກອບບັນຍາກາດ</label>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => fileInputRef.current?.click()}>
              📷 ອັບໂຫຼດຮູບພາບ
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
            {form.images && form.images.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {form.images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button
                      type="button"
                      onClick={() => set('images', form.images.filter((_, idx) => idx !== i))}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        background: 'var(--error)', color: 'white', border: 'none',
                        borderRadius: '50%', width: '18px', height: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '10px'
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>💾 ບັນທຶກ</button>
        </div>
      </div>
    </div>
  );
}
