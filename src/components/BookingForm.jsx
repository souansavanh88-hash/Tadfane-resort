import { useState, useMemo, useRef, useEffect } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastProvider';
import {
  ROOM_TYPES, formatCurrency, daysBetween, todayStr, addDays
} from '../data/initialData';
import PrintReceipt from './PrintReceipt';
import CheckInRegistrationModal from './CheckInRegistrationModal';

export default function BookingForm({
  preselectedRoom,
  defaultCheckIn,
  initialDirectCheckIn = false,
  bookingToEdit = null,
  onClose,
  onBack,
}) {
  const { rooms, createBooking, updateBooking, isRoomAvailableForDates } = useHotel();
  const { currentUser, users } = useAuth();
  const { toast } = useToast();

  const isEditing = Boolean(bookingToEdit);
  const today = todayStr();
  const initialCheckIn = bookingToEdit?.checkIn || defaultCheckIn || today;
  const initialCheckOut = bookingToEdit?.checkOut || addDays(initialCheckIn, 1);

  const [isDirectCheckIn, setIsDirectCheckIn] = useState(
    isEditing ? bookingToEdit.status === 'checked_in' : initialDirectCheckIn
  );

  const [form, setForm] = useState({
    guestName: bookingToEdit?.guestName || '',
    guestPhone: bookingToEdit?.guestPhone || '',
    guestNationality: bookingToEdit?.guestNationality || 'ລາວ',
    guestCount: bookingToEdit?.guestCount || 1,
    passportNo: bookingToEdit?.passportNo || '',
    dob: bookingToEdit?.dob || '',
    email: bookingToEdit?.email || '',
    address: bookingToEdit?.address || '',
    roomId: bookingToEdit?.roomId || preselectedRoom?.id || '',
    checkIn: initialCheckIn,
    checkOut: initialCheckOut,
    discount: bookingToEdit?.discount || 0,
    deposit: bookingToEdit?.deposit || 0,
    paymentMethod: bookingToEdit?.paymentMethod || 'cash',
    bookedByStaff: bookingToEdit?.bookedByStaff || currentUser?.name || 'ພະນັກງານຕ້ອນຮັບ',
    bookingChannel: bookingToEdit?.bookingChannel || 'walkin',
    notes: bookingToEdit?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [showRegForm, setShowRegForm] = useState(false);
  const receiptBodyRef = useRef(null);

  useEffect(() => {
    if (completedReceipt && receiptBodyRef.current) {
      receiptBodyRef.current.scrollTop = 0;
      receiptBodyRef.current.closest('.modal')?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [completedReceipt]);

  const selectedRoom = rooms.find(r => r.id === form.roomId);
  const nights = form.checkIn && form.checkOut && form.checkOut > form.checkIn
    ? Math.max(1, daysBetween(form.checkIn, form.checkOut))
    : 1;
  const roomTotal = (selectedRoom?.price || 0) * nights;
  const totalAmount = Math.max(0, roomTotal - Number(form.discount || 0));
  const remainingAmount = Math.max(0, totalAmount - Number(form.deposit || 0));

  const roomOptions = useMemo(() => {
    return rooms.map(r => ({
      ...r,
      isAvailableForDates: isRoomAvailableForDates(
        r.id,
        form.checkIn,
        form.checkOut,
        bookingToEdit?.id || null
      ),
    }));
  }, [rooms, form.checkIn, form.checkOut, bookingToEdit, isRoomAvailableForDates]);

  const availableCount = roomOptions.filter(r => r.isAvailableForDates).length;

  const set = (field, value) => {
    setForm(p => {
      const next = { ...p, [field]: value };
      if (field === 'checkIn' && value && next.checkOut <= value) {
        next.checkOut = addDays(value, 1);
      }
      return next;
    });
    if (errors[field]) setErrors(p => ({ ...p, [field]: null }));
  };

  const setNightsPreset = (n) => {
    if (!form.checkIn) return;
    set('checkOut', addDays(form.checkIn, n));
  };

  const handleDepositPreset = (percent) => {
    if (percent === 100) set('deposit', totalAmount);
    else if (percent === 50) set('deposit', Math.round(totalAmount / 2));
    else set('deposit', 0);
  };

  const validate = () => {
    const e = {};
    if (!form.guestName.trim()) e.guestName = 'ກະລຸນາໃສ່ຊື່ລູກຄ້າ';
    if (!form.roomId) e.roomId = 'ກະລຸນາເລືອກຫ້ອງ';
    if (!form.checkIn) e.checkIn = 'ກະລຸນາເລືອກວັນເຂົ້າ';
    if (!form.checkOut) e.checkOut = 'ກະລຸນາເລືອກວັນອອກ';
    if (form.checkIn && form.checkOut && form.checkIn >= form.checkOut) {
      e.checkOut = 'ວັນອອກຕ້ອງຫຼັງວັນເຂົ້າ';
    }

    if (form.roomId && form.checkIn && form.checkOut && form.checkIn < form.checkOut) {
      const isAvail = isRoomAvailableForDates(
        form.roomId,
        form.checkIn,
        form.checkOut,
        bookingToEdit?.id || null
      );
      if (!isAvail) {
        e.roomId = `⚠️ ຫ້ອງ ${selectedRoom?.number} ບໍ່ວ່າງໃນຊ່ວງວັນທີ ${form.checkIn} ຫາ ${form.checkOut} (ມີການຈອງແລ້ວ)`;
      }
    }

    if (Number(form.deposit) > totalAmount) e.deposit = 'ເງິນມັດຈຳຫຼາຍກວ່າຍອດລວມ';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const finalDeposit = isDirectCheckIn ? totalAmount : Number(form.deposit || 0);

    if (isEditing) {
      updateBooking(bookingToEdit.id, {
        ...form,
        nights,
        roomPrice: selectedRoom?.price || 0,
        totalAmount,
        deposit: finalDeposit,
        remainingAmount: isDirectCheckIn ? 0 : Math.max(0, totalAmount - finalDeposit),
        guestCount: Number(form.guestCount),
        discount: Number(form.discount || 0),
        isDirectCheckIn,
        status: isDirectCheckIn ? 'checked_in' : (bookingToEdit.status === 'checked_in' ? 'checked_in' : 'booked'),
      });
      toast(`✅ ອັບເດດການຈອງ ${bookingToEdit.id} ສຳເລັດ!`, 'success');
    } else {
      const booking = createBooking({
        ...form,
        nights,
        roomPrice: selectedRoom?.price || 0,
        totalAmount,
        deposit: finalDeposit,
        remainingAmount: isDirectCheckIn ? 0 : Math.max(0, totalAmount - finalDeposit),
        guestCount: Number(form.guestCount),
        discount: Number(form.discount || 0),
        isDirectCheckIn,
        status: isDirectCheckIn ? 'checked_in' : 'booked',
      });

      const actionText = isDirectCheckIn ? 'ຄິດເງິນ & ເຂົ້າພັກ' : 'ຈອງຫ້ອງ';
      toast(`✅ ${actionText} ຫ້ອງ ${selectedRoom?.number} ສຳເລັດ! (${booking.id})`, 'success');
      setCompletedReceipt({
        booking,
        room: selectedRoom,
        type: isDirectCheckIn ? 'sale' : 'booking',
        paidAmount: finalDeposit,
        payMethod: form.paymentMethod,
      });
      return;
    }

    onClose();
  };

  if (completedReceipt) {
    if (showRegForm) {
      return (
        <CheckInRegistrationModal
          booking={completedReceipt.booking}
          room={completedReceipt.room}
          onBack={() => setShowRegForm(false)}
          onClose={onClose}
          onCompleted={(updatedBooking) => {
            setCompletedReceipt(prev => ({ ...prev, booking: updatedBooking }));
            setShowRegForm(false);
          }}
        />
      );
    }
    return (
      <>
        <div className="modal-header">
          <span className="modal-title">
            {completedReceipt.booking.status === 'checked_in'
              ? `🧾 ໃບບິນ / Receipt — ${completedReceipt.room?.number || ''} (${completedReceipt.booking.id})`
              : `📋 ໃບຢືນຢັນຈອງ / Booking Slip (${completedReceipt.booking.id})`}
          </span>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div ref={receiptBodyRef} className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <div style={{
            padding: '10px 14px',
            marginBottom: '12px',
            borderRadius: '10px',
            background: '#dcfce7',
            border: '1px solid #86efac',
            color: '#166534',
            fontWeight: 600,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            <span>
              ✅ {completedReceipt.booking.status === 'checked_in'
                ? 'ຂາຍຫ້ອງ & Check-in ສຳເລັດ! / Sale Complete'
                : 'ບັນທຶກການຈອງສຳເລັດ! / Booking Confirmed'}
            </span>
            <span style={{ fontSize: '0.78rem' }}>ກົດ 🖨️ ພິມ / Print ດ້ານລຸ່ມ</span>
          </div>
          <PrintReceipt
            booking={completedReceipt.booking}
            room={completedReceipt.room}
            type={completedReceipt.type}
            paidAmount={completedReceipt.paidAmount}
            payMethod={completedReceipt.payMethod}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>✅ ສຳເລັດ / Close</button>
          <button
            type="button"
            className="btn"
            style={{ background: '#d96528', color: '#fff', fontWeight: 700 }}
            onClick={() => setShowRegForm(true)}
          >
            📱 ຟອມລົງທະບຽນ & ເຊັນຊື່ (iPad)
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>
            🖨️ ພິມໃບບິນ / Print
          </button>
        </div>
      </>
    );
  }

  const nationalities = ['ລາວ', 'ໄທ', 'ຈີນ', 'ຫວຽດນາມ', 'ເກົາຫຼີ', 'ຍີ່ປຸ່ນ', 'ຝຣັ່ງ', 'ອາເມຣິກາ', 'ອື່ນໆ'];

  const channels = [
    { key: 'walkin', label: '🚶 Walk-in (ໜ້າເຄົາເຕີ)' },
    { key: 'online', label: '🌐 ລູກຄ້າຈອງອອນລາຍ' },
    { key: 'phone', label: '📞 ໂທລະສັບ / WhatsApp' },
    { key: 'facebook', label: '📱 Facebook / Line' },
    { key: 'agoda', label: '🏨 Agoda / Booking.com' },
  ];

  return (
    <>
      <div className="modal-header">
        <div>
          {onBack && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginRight: '8px' }}>
              ← ກັບ
            </button>
          )}
          <span className="modal-title">
            {isEditing
              ? `✏️ ແກ້ໄຂການຈອງ (${bookingToEdit.id})`
              : (isDirectCheckIn ? '💵 ຄິດເງິນ & ເຂົ້າພັກທັນທີ' : '📋 ຈອງຫ້ອງໃໝ່')}
          </span>
        </div>
        <button type="button" className="modal-close" onClick={onClose}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'grid', gap: '0', maxHeight: '72vh', overflowY: 'auto' }}>

          {/* Mode Selector (only when creating new booking) */}
          {!isEditing && (
            <div style={{
              background: 'var(--bg-elevated)',
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              marginBottom: '18px',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                className={`btn ${!isDirectCheckIn ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                onClick={() => setIsDirectCheckIn(false)}
              >
                📋 ຈອງໄວ້ກ່ອນ (ລໍເຂົ້າພັກ)
              </button>
              <button
                type="button"
                className={`btn ${isDirectCheckIn ? 'btn-success' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                onClick={() => {
                  setIsDirectCheckIn(true);
                  set('deposit', totalAmount);
                }}
              >
                💵 ຈ່າຍເຕັມ & Check-in ທັນທີ (Walk-in)
              </button>
            </div>
          )}

          {/* Step 1: ວັນທີ & ເລືອກຫ້ອງ */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px'
            }}>📅 1. ເລືອກວັນທີ & ຫ້ອງພັກ</div>

            <div className="form-row">
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">ວັນເຂົ້າ (Check-in) <span className="required">*</span></label>
                <input className="form-input" type="date" value={form.checkIn}
                  onChange={e => set('checkIn', e.target.value)} />
                {errors.checkIn && <div className="form-error">{errors.checkIn}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">ວັນອອກ (Check-out) <span className="required">*</span></label>
                <input className="form-input" type="date" value={form.checkOut}
                  min={form.checkIn ? addDays(form.checkIn, 1) : today}
                  onChange={e => set('checkOut', e.target.value)} />
                {errors.checkOut && <div className="form-error">{errors.checkOut}</div>}
              </div>
            </div>

            {/* Quick Nights Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>ຈຳນວນຄືນດ່ວນ:</span>
              {[1, 2, 3, 5, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${nights === n ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setNightsPreset(n)}
                >
                  {n} ຄືນ
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  ຫ້ອງພັກ <span className="required">*</span>{' '}
                  <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
                    (ວ່າງ {availableCount} ຫ້ອງ)
                  </span>
                </label>
                <select
                  className="form-select"
                  value={form.roomId}
                  onChange={e => set('roomId', e.target.value)}
                >
                  <option value="">— ເລືອກຫ້ອງ —</option>
                  <optgroup label={`🟢 ຫ້ອງວ່າງໃນຊ່ວງວັນທີນີ້ (${availableCount} ຫ້ອງ)`}>
                    {roomOptions.filter(r => r.isAvailableForDates).map(r => (
                      <option key={r.id} value={r.id}>
                        ຫ້ອງ {r.number} — {ROOM_TYPES[r.type]} ({formatCurrency(r.price)}/ຄືນ)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🔴 ບໍ່ວ່າງ (ມີການຈອງຊ້ອນ ຫຼື ສ້ອມແປງ)">
                    {roomOptions.filter(r => !r.isAvailableForDates).map(r => (
                      <option key={r.id} value={r.id} disabled>
                        ຫ້ອງ {r.number} — {ROOM_TYPES[r.type]} (⛔ ບໍ່ວ່າງ)
                      </option>
                    ))}
                  </optgroup>
                </select>
                {errors.roomId && <div className="form-error">{errors.roomId}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">ລາຄາ/ຄືນ</label>
                <input className="form-input" value={formatCurrency(selectedRoom?.price || 0)} readOnly
                  style={{ opacity: 0.75 }} />
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Step 2: ຂໍ້ມູນລູກຄ້າ */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px'
            }}>👤 2. ຂໍ້ມູນລູກຄ້າ & ຊ່ອງທາງຈອງ</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ຊື່ລູກຄ້າ <span className="required">*</span></label>
                <input className="form-input" placeholder="ຊື່-ນາມສະກຸນ" value={form.guestName}
                  onChange={e => set('guestName', e.target.value)} />
                {errors.guestName && <div className="form-error">{errors.guestName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">ເບີໂທ</label>
                <input className="form-input" placeholder="020 xxxx xxxx" value={form.guestPhone}
                  onChange={e => set('guestPhone', e.target.value)} type="tel" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🌐 ຊ່ອງທາງການຈອງ</label>
                <select
                  className="form-select"
                  value={form.bookingChannel}
                  onChange={e => set('bookingChannel', e.target.value)}
                >
                  {channels.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">👨‍💼 ພະນັກງານຜູ້ຮັບຈອງ</label>
                <select
                  className="form-select"
                  value={form.bookedByStaff}
                  onChange={e => set('bookedByStaff', e.target.value)}
                >
                  {users?.map(u => (
                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                  ))}
                  <option value="ລູກຄ້າຈອງເອງ (Online)">🌐 ລູກຄ້າຈອງເອງ (Online)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ສັນຊາດ</label>
                <select className="form-select" value={form.guestNationality}
                  onChange={e => set('guestNationality', e.target.value)}>
                  {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ຈຳນວນຜູ້ເຂົ້າພັກ</label>
                <input className="form-input" type="number" min="1" max="10" value={form.guestCount}
                  onChange={e => set('guestCount', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🪪 ເລກບັດ / ພາສປອດ (ID / Passport)</label>
                <input className="form-input" placeholder="PA0209560..." value={form.passportNo}
                  onChange={e => set('passportNo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">🎂 ວັນເດືອນປີເກີດ</label>
                <input className="form-input" type="date" value={form.dob}
                  onChange={e => set('dob', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">📧 Email</label>
                <input className="form-input" type="email" placeholder="name@email.com" value={form.email}
                  onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">📍 ທີ່ຢູ່ / ແຂວງ</label>
                <input className="form-input" placeholder="ບ້ານ / ເມືອງ / ແຂວງ..." value={form.address}
                  onChange={e => set('address', e.target.value)} />
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Step 3: ການຊຳລະເງິນ */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px'
            }}>💰 3. ການຊຳລະເງິນ & ຄິດໄລ່ຍອດ</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ສ່ວນຫຼຸດ (₭)</label>
                <input className="form-input" type="number" min="0" value={form.discount}
                  onChange={e => set('discount', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>ເງິນມັດຈຳ / ຊຳລະແລ້ວ (₭)</label>
                  {!isDirectCheckIn && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleDepositPreset(100)}>100%</button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleDepositPreset(50)}>50%</button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleDepositPreset(0)}>0</button>
                    </div>
                  )}
                </div>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={isDirectCheckIn ? totalAmount : form.deposit}
                  disabled={isDirectCheckIn}
                  onChange={e => set('deposit', e.target.value)}
                  placeholder="0"
                />
                {errors.deposit && <div className="form-error">{errors.deposit}</div>}
              </div>
            </div>

            <div className="calc-box" style={{ marginBottom: '16px' }}>
              <div className="calc-row">
                <span>{formatCurrency(selectedRoom?.price || 0)} × {nights} ຄືນ</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(roomTotal)}</span>
              </div>
              {Number(form.discount) > 0 && (
                <div className="calc-row" style={{ color: 'var(--success)' }}>
                  <span>ສ່ວນຫຼຸດ</span>
                  <span>−{formatCurrency(Number(form.discount))}</span>
                </div>
              )}
              <div className="calc-row calc-row-total">
                <span>ຍອດລວມ</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="calc-row calc-row-deposit">
                <span>{isDirectCheckIn ? 'ຊຳລະເຕັມຈຳນວນ' : 'ເງິນມັດຈຳ'}</span>
                <span>−{formatCurrency(isDirectCheckIn ? totalAmount : Number(form.deposit))}</span>
              </div>
              <div className="calc-row calc-row-remaining">
                <span>ຍອດຄ້າງຈ່າຍ</span>
                <span>{formatCurrency(isDirectCheckIn ? 0 : remainingAmount)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">ຊ່ອງທາງຈ່າຍເງິນ</label>
              <div className="payment-options">
                {[
                  { key: 'cash', icon: '💵', label: 'ເງິນສົດ' },
                  { key: 'transfer', icon: '🏦', label: 'ໂອນເງິນ' },
                  { key: 'qr', icon: '📱', label: 'BCEL One QR' },
                  { key: 'card', icon: '💳', label: 'ບັດ' },
                ].map(m => (
                  <div
                    key={m.key}
                    className={`payment-option ${form.paymentMethod === m.key ? 'selected' : ''}`}
                    onClick={() => set('paymentMethod', m.key)}
                  >
                    <span className="payment-option-icon">{m.icon}</span>
                    <span className="payment-option-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ໝາຍເຫດ</label>
              <textarea className="form-textarea" placeholder="ໝາຍເຫດເພີ່ມເຕີມ..." value={form.notes}
                onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ຍົກເລີກ</button>
          <button type="submit" className={`btn ${isDirectCheckIn ? 'btn-success' : 'btn-primary'} btn-lg`}>
            {isEditing
              ? '💾 ບັນທຶກການແກ້ໄຂ'
              : (isDirectCheckIn ? '💵 ຄິດເງິນ & ຢືນຢັນເຂົ້າພັກ' : '✅ ຢືນຢັນການຈອງ')}
          </button>
        </div>
      </form>
    </>
  );
}
