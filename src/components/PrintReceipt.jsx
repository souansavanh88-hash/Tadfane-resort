import { useState } from 'react';
import { useHotel } from '../context/HotelContext';
import { formatCurrency, ROOM_TYPES } from '../data/initialData';

const ROOM_TYPES_EN = {
  standard: 'Standard Room',
  superior: 'Superior Room',
  deluxe: 'Deluxe Room',
  suite: 'Suite Room',
  family: 'Family Room',
};

const NATIONALITIES_EN = {
  'ລາວ': 'Lao',
  'ໄທ': 'Thai',
  'ຈີນ': 'Chinese',
  'ຫວຽດນາມ': 'Vietnamese',
  'ເກົາຫຼີ': 'Korean',
  'ຍີ່ປຸ່ນ': 'Japanese',
  'ຝຣັ່ງ': 'French',
  'ອາເມຣິກາ': 'American',
  'ອື່ນໆ': 'Other',
};

const PAY_METHOD_LABELS = {
  cash: { lo: 'ເງິນສົດ', en: 'Cash' },
  transfer: { lo: 'ໂອນເງິນ', en: 'Bank Transfer' },
  qr: { lo: 'QR Code', en: 'QR Code' },
  card: { lo: 'ບັດ', en: 'Card' },
};

function formatDateEn(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateLoShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('lo-LA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PrintReceipt({
  booking,
  room,
  type = 'checkin',
  paidAmount,
  payMethod,
  cashReceived,
  changeAmount,
}) {
  const { hotelInfo, lang } = useHotel();
  const [receiptMode, setReceiptMode] = useState(() => (lang === 'en' ? 'en' : 'bi')); // 'bi' | 'en' | 'lo'

  const txt = (lo, en) => {
    if (receiptMode === 'en') return en;
    if (receiptMode === 'lo') return lo;
    return `${lo} / ${en}`;
  };

  const now = new Date();
  const dateTimeStr = receiptMode === 'lo'
    ? now.toLocaleString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : now.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  const formatReceiptDate = (dateStr) => {
    if (receiptMode === 'en') return formatDateEn(dateStr);
    if (receiptMode === 'lo') return formatDateLoShort(dateStr);
    return `${formatDateEn(dateStr)} (${formatDateLoShort(dateStr)})`;
  };

  const isCheckout = type === 'checkout';
  const isBooking = type === 'booking';
  const isSale = type === 'sale';
  const isCheckin = !isCheckout && !isBooking && !isSale;

  const titleMap = {
    checkout: { lo: 'ໃບບິນ Check-out', en: 'CHECK-OUT RECEIPT' },
    booking: { lo: 'ໃບຢືນຢັນຈອງ & ມັດຈຳ', en: 'BOOKING CONFIRMATION' },
    sale: { lo: 'ໃບບິນຂາຍຫ້ອງພັກ (Cashier)', en: 'OFFICIAL ROOM RECEIPT' },
    checkin: { lo: 'ໃບຮັບເງິນ Check-in', en: 'CHECK-IN RECEIPT' },
  };
  const activeTitle = titleMap[isCheckout ? 'checkout' : isBooking ? 'booking' : isSale ? 'sale' : 'checkin'];

  const groupRooms = booking?.groupRooms?.length > 1 ? booking.groupRooms : null;
  const validExtras = (booking?.extraCharges || []).filter(e => e?.desc && Number(e?.amount) > 0);
  const extraSum = validExtras.reduce((s, e) => s + Number(e.amount || 0), 0);
  const nights = booking?.nights || 1;
  const unitPrice = booking?.roomPrice ?? room?.price ?? 0;
  const baseTotal = groupRooms
    ? Number(booking?.groupTotalAmount ?? groupRooms.reduce((s, gr) => s + Number(gr.subtotal || (gr.price * nights)), 0))
    : Number(booking?.totalAmount || 0);
  const displayTotal = booking?.finalTotal ?? (baseTotal + (groupRooms ? 0 : extraSum));

  const method = payMethod || booking?.finalPaymentMethod || booking?.remainingPaymentMethod || booking?.paymentMethod || 'cash';
  const methodInfo = PAY_METHOD_LABELS[method] || { lo: method, en: method };
  const methodText = txt(methodInfo.lo, methodInfo.en);

  const depositAmt = groupRooms && booking?.groupPaidAmount !== undefined
    ? Number(booking.groupPaidAmount)
    : Number(booking?.deposit || 0);
  const remPaidAmt = Number(booking?.remainingPaid || 0);
  const checkoutPaidAmt = Number(booking?.finalRemaining ?? booking?.finalPaymentAmount ?? 0);

  const nonCheckoutPaid = paidAmount !== undefined && paidAmount !== null
    ? Number(paidAmount)
    : (depositAmt + remPaidAmt);
  const totalPaid = isCheckout
    ? depositAmt + remPaidAmt + checkoutPaidAmt
    : Math.max(nonCheckoutPaid, depositAmt + remPaidAmt);
  const splitDepositCheckin = isCheckin && depositAmt > 0 && remPaidAmt > 0 && nonCheckoutPaid === remPaidAmt;
  const outstanding = Math.max(0, displayTotal - totalPaid);
  const computedChange = cashReceived > 0
    ? Math.max(0, changeAmount !== undefined ? Number(changeAmount) : Number(cashReceived) - nonCheckoutPaid)
    : 0;

  const roomTypeLo = ROOM_TYPES[room?.type] || room?.type || '';
  const roomTypeEn = ROOM_TYPES_EN[room?.type] || room?.type || '';
  const roomDisplay = groupRooms
    ? (receiptMode === 'en'
      ? `Rooms ${groupRooms.map(g => g.number).join(', ')} (${groupRooms.length} Rooms)`
      : receiptMode === 'lo'
        ? `ຫ້ອງ ${groupRooms.map(g => g.number).join(', ')} (${groupRooms.length} ຫ້ອງ)`
        : `ຫ້ອງ/Rms ${groupRooms.map(g => g.number).join(', ')} (${groupRooms.length})`)
    : (receiptMode === 'en'
      ? `Room ${room?.number || booking?.roomId} (${roomTypeEn})`
      : receiptMode === 'lo'
        ? `ຫ້ອງ ${room?.number || booking?.roomId} (${roomTypeLo})`
        : `ຫ້ອງ/Rm ${room?.number || booking?.roomId} (${roomTypeEn})`);

  const natRaw = booking?.guestNationality || '';
  const natEn = NATIONALITIES_EN[natRaw] || natRaw;
  const natDisplay = receiptMode === 'en'
    ? natEn
    : receiptMode === 'lo'
      ? natRaw
      : (natEn && natEn !== natRaw ? `${natRaw} / ${natEn}` : natRaw);

  return (
    <div className="receipt-printable">
      {/* Receipt Language Switcher & Save PDF Button (Hidden when printing) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          🌐 ພາສາໃນໃບບິນ / Receipt Language:
        </span>
        {[
          { key: 'bi', label: '🇱🇦+🇬🇧 2 ພາສາ (Lao + EN)' },
          { key: 'en', label: '🇬🇧 English Only' },
          { key: 'lo', label: '🇱🇦 ພາສາລາວ' },
        ].map(opt => (
          <button
            key={opt.key}
            type="button"
            className={`btn btn-sm ${receiptMode === opt.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.74rem', padding: '4px 10px' }}
            onClick={() => setReceiptMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          style={{ fontSize: '0.74rem', padding: '4px 10px', fontWeight: 700 }}
          onClick={() => window.print()}
        >
          📄 ບັນທຶກເປັນ PDF
        </button>
      </div>

      <div className="receipt" id="receipt-content">
        {/* Header */}
        <div className="receipt-header">
          {receiptMode !== 'en' && (
            <div className="receipt-hotel">{hotelInfo?.name || 'ຣີສອດຕາດຟານ'}</div>
          )}
          {(receiptMode !== 'lo' || !hotelInfo?.name) && (
            <div className={receiptMode === 'en' ? 'receipt-hotel' : ''} style={{ fontWeight: 'bold', fontSize: receiptMode === 'en' ? '18px' : '14px' }}>
              {hotelInfo?.nameEn || 'Tad Fane Resort'}
            </div>
          )}
          {hotelInfo?.address && <div style={{ fontSize: '11px', marginTop: '2px' }}>{hotelInfo.address}</div>}
          {hotelInfo?.phone && <div>{txt('ໂທ', 'Tel')}: {hotelInfo.phone}</div>}
          <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: receiptMode === 'bi' ? '13px' : '15px' }}>
            {receiptMode === 'bi' ? (
              <>
                <div>====[ {activeTitle.en} ]====</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>{activeTitle.lo}</div>
              </>
            ) : (
              `====[ ${receiptMode === 'en' ? activeTitle.en : activeTitle.lo} ]====`
            )}
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Booking Info */}
        <div className="receipt-row"><span>{txt('ເລກທີ', 'Receipt No')}:</span><span style={{ fontWeight: 'bold' }}>{booking?.id}</span></div>
        <div className="receipt-row"><span>{txt('ວັນທີ', 'Date')}:</span><span>{dateTimeStr}</span></div>
        <div className="receipt-row"><span>{txt('ລູກຄ້າ', 'Guest')}:</span><span style={{ fontWeight: 'bold' }}>{booking?.guestName}</span></div>
        {booking?.guestPhone && booking.guestPhone !== '-' && (
          <div className="receipt-row"><span>{txt('ເບີໂທ', 'Phone')}:</span><span>{booking.guestPhone}</span></div>
        )}
        {natDisplay && <div className="receipt-row"><span>{txt('ສັນຊາດ', 'Nationality')}:</span><span>{natDisplay}</span></div>}
        {booking?.bookedByStaff && <div className="receipt-row"><span>{txt('ພະນັກງານ', 'Staff')}:</span><span>{booking.bookedByStaff}</span></div>}

        <hr className="receipt-divider" />

        <div className="receipt-row"><span>{txt('ຫ້ອງ', 'Room')}:</span><span style={{ fontWeight: 'bold' }}>{roomDisplay}</span></div>
        <div className="receipt-row"><span>{txt('ວັນເຂົ້າ', 'Check-in')}:</span><span>{formatReceiptDate(booking?.checkIn)}</span></div>
        <div className="receipt-row"><span>{txt('ວັນອອກ', 'Check-out')}:</span><span>{formatReceiptDate(booking?.checkOut)}</span></div>
        <div className="receipt-row">
          <span>{txt('ຈຳນວນຄືນ', 'Nights')}:</span>
          <span>{receiptMode === 'en' ? `${nights} Night(s)` : receiptMode === 'lo' ? `${nights} ຄືນ` : `${nights} ຄືນ / Night(s)`}</span>
        </div>

        <hr className="receipt-divider" />

        {/* Charges */}
        {groupRooms ? (
          groupRooms.map((gr, idx) => (
            <div key={gr.roomId || idx} className="receipt-row">
              <span>
                • {txt(`ຫ້ອງ ${gr.number}`, `Rm ${gr.number}`)} ({ROOM_TYPES_EN[gr.type] || gr.type}) × {nights}N
              </span>
              <span>{formatCurrency(Number(gr.price || 0) * nights)}</span>
            </div>
          ))
        ) : (
          <div className="receipt-row">
            <span>{txt(`ຄ່າຫ້ອງ (${nights} ຄືນ)`, `Room (${nights}N)`)}</span>
            <span>{formatCurrency(unitPrice * nights)}</span>
          </div>
        )}
        {Number(booking?.groupDiscount ?? booking?.discount) > 0 && (
          <div className="receipt-row"><span>{txt('ສ່ວນຫຼຸດ', 'Discount')}</span><span>-{formatCurrency(booking?.groupDiscount ?? booking?.discount)}</span></div>
        )}

        {/* Extra charges */}
        {validExtras.map((e, i) => (
          <div key={i} className="receipt-row">
            <span>{e.desc}</span>
            <span>{formatCurrency(Number(e.amount))}</span>
          </div>
        ))}

        <hr className="receipt-divider" />

        <div className="receipt-row receipt-total">
          <span>{txt('ຍອດລວມທັງໝົດ', 'Grand Total')}</span>
          <span>{formatCurrency(displayTotal)}</span>
        </div>

        {!isCheckout && (
          <>
            {splitDepositCheckin ? (
              <>
                <div className="receipt-row"><span>{txt('ເງິນມັດຈຳກ່ອນໜ້າ', 'Prior Deposit')}</span><span>-{formatCurrency(depositAmt)}</span></div>
                <div className="receipt-row">
                  <span>{txt('ຮັບຊຳລະ', 'Paid')} ({methodText})</span>
                  <span>{formatCurrency(remPaidAmt)}</span>
                </div>
              </>
            ) : (
              totalPaid > 0 && (
                <div className="receipt-row">
                  <span>{txt('ຊຳລະແລ້ວ', 'Paid')} ({methodText})</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>
              )
            )}
            {cashReceived > 0 && method === 'cash' && (
              <>
                <div className="receipt-row"><span>{txt('ຮັບເງິນສົດ', 'Cash Received')}</span><span>{formatCurrency(cashReceived)}</span></div>
                <div className="receipt-row"><span>{txt('ເງິນທອນ', 'Change')}</span><span>{formatCurrency(computedChange)}</span></div>
              </>
            )}
            <div className="receipt-row" style={{ fontWeight: 'bold' }}>
              <span>{txt('ຍອດຄ້າງຈ່າຍ', 'Balance Due')}</span>
              <span>
                {outstanding > 0
                  ? formatCurrency(outstanding)
                  : `0 ₭ (${txt('ຊຳລະຄົບ', 'Paid in Full')})`}
              </span>
            </div>
          </>
        )}

        {isCheckout && (
          <>
            {depositAmt > 0 && (
              <div className="receipt-row"><span>{txt('ເງິນມັດຈຳ', 'Deposit')}</span><span>-{formatCurrency(depositAmt)}</span></div>
            )}
            {remPaidAmt > 0 && (
              <div className="receipt-row"><span>{txt('ຊຳລະຕອນ Check-in', 'Paid at Check-in')}</span><span>-{formatCurrency(remPaidAmt)}</span></div>
            )}
            {checkoutPaidAmt > 0 && (
              <div className="receipt-row">
                <span>{txt('ຮັບຊຳລະ', 'Paid')} ({methodText})</span>
                <span>{formatCurrency(checkoutPaidAmt)}</span>
              </div>
            )}
            <hr className="receipt-divider" />
            <div className="receipt-row receipt-total">
              <span>{txt('ຍອດທີ່ຊຳລະທັງໝົດ', 'Total Paid')}</span>
              <span>{formatCurrency(totalPaid)}</span>
            </div>
          </>
        )}

        <hr className="receipt-divider" />

        <div className="receipt-footer">
          {receiptMode !== 'en' && <div>ຂອບໃຈທີ່ໃຊ້ບໍລິການ!</div>}
          {receiptMode !== 'lo' && <div>Thank you for your stay!</div>}
          {hotelInfo?.phone && <div>📞 {hotelInfo.phone}</div>}
          <div style={{ marginTop: '8px', fontSize: '10px' }}>
            * {txt('ໃບບິນນີ້ເປັນຫຼັກຖານການຊຳລະ', 'Official Proof of Payment')} *
          </div>
        </div>
      </div>
    </div>
  );
}
