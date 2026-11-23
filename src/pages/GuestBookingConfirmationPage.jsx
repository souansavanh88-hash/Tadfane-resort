import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useToast } from '../components/ToastProvider';
import { decodeBookingPayload, buildBookingPayload } from '../utils/bookingShare';
import SignaturePadModal from '../components/SignaturePadModal';
import { formatCurrency } from '../data/initialData';

const ROOM_TYPES_LABEL = {
  standard: { lo: 'Standard', en: 'Standard Room', th: 'ห้อง Standard', vi: 'Phòng Standard' },
  superior: { lo: 'Superior', en: 'Superior Room', th: 'ห้อง Superior', vi: 'Phòng Superior' },
  deluxe: { lo: 'Deluxe', en: 'Deluxe Room', th: 'ห้อง Deluxe', vi: 'Phòng Deluxe' },
  suite: { lo: 'Suite', en: 'Suite Room', th: 'ห้อง Suite', vi: 'Phòng Suite' },
  family: { lo: 'Family', en: 'Family Room', th: 'ห้อง Family', vi: 'Phòng Family' },
};

const FORM_TEXT = {
  lo: {
    formTitle: 'ໃບຢືນຢັນການຈອງ & ລົງທະບຽນ',
    secBooking: 'ຂໍ້ມູນການຈອງຫ້ອງ',
    secGuest: 'ຂໍ້ມູນລູກຄ້າ',
    secPayment: 'ຮູບແບບການຊຳລະເງິນ',
    secTerms: 'ກະລຸນາຊາບ / ຂໍ້ກຳນົດຂອງຣີສອດ:',
    titlePrefix: 'ຄຳນຳໜ້າ',
    lastName: 'ນາມສະກຸນ',
    firstName: 'ຊື່',
    bookingNo: 'ລະຫັດການຈອງ',
    roomNo: 'ເບີຫ້ອງ',
    roomType: 'ປະເພດຫ້ອງ',
    checkInDate: 'ວັນເຂົ້າພັກ',
    guestCount: 'ຈຳນວນແຂກ',
    roomRate: 'ລາຄາຫ້ອງ/ຄືນ',
    checkOutDate: 'ວັນອອກ',
    nights: 'ຈຳນວນຄືນ',
    flight: 'ຖ້ຽວບິນ / ພາຫະນະ',
    bookedVia: 'ຈອງຜ່ານ / ບໍລິສັດ',
    prevStays: 'ຄັ້ງທີເຄີຍພັກ',
    notes: 'ໝາຍເຫດ',
    address: 'ທີ່ຢູ່',
    city: 'ເມືອງ',
    province: 'ແຂວງ',
    email: 'ອີເມວ',
    phone: 'ເບີໂທ',
    country: 'ປະເທດ / ສັນຊາດ',
    dob: 'ວັນເດືອນປີເກີດ',
    idNo: 'ເລກບັດປະຈຳຕົວ / ພາສປອດ',
    payCash: 'ເງິນສົດ',
    payTransfer: 'ໂອນເງິນ',
    payQr: 'QR Code',
    payCard: 'ບັດເຄຣດິດ/ເດບິດ',
    payCompany: 'ບໍລິສັດ',
    noInvoice: 'ບໍ່ຕ້ອງການໃບບິນ',
    balanceSummary: 'ສະຫຼຸບຍອດຊຳລະ',
    adultsShort: 'ຜູ້ໃຫຍ່ (A)',
    childrenShort: 'ເດັກ (C)',
    agreeText: (hotelName) =>
      `ໂດຍການເຊັນຊື່ໃນໃບລົງທະບຽນນີ້, ຂ້າພະເຈົ້າຂໍຢືນຢັນວ່າໄດ້ອ່ານ, ເຂົ້າໃຈ ແລະ ຍອມຮັບປະຕິບັດຕາມນະໂຍບາຍ, ກົດລະບຽບ ແລະ ຂໍ້ກຳນົດທັງໝົດຂອງ ${hotelName}. ຂ້າພະເຈົ້າຍິນຍອມໃຫ້ທາງຣີສອດເກັບຄ່າບໍລິການເພີ່ມເຕີມ ຫຼື ຄ່າເສຍຫາຍ (ຖ້າມີ) ກ່ອນອອກຈາກຣີສອດ.`,
    guestSigLabel: 'ລາຍເຊັນລູກຄ້າ / Guest Signature',
    staffSigLabel: 'ພະນັກງານຕ້ອນຮັບ / Receptionist',
    signedAtLabel: 'ເຊັນເມື່ອ',
    notSignedYet: '👉 ກົດບ່ອນນີ້ເພື່ອເຊັນຊື່ດ້ວຍນິ້ວມື (Tap here to sign)',
    btnSignature: 'Signature',
    btnEditSignature: 'ແກ້ໄຂລາຍເຊັນ',
    rules: (inTime, outTime) => [
      `ເວລາເຂົ້າພັກ (Check-in) ຕັ້ງແຕ່ ${inTime} ໂມງ ແລະ ເວລາອອກ (Check-out) ກ່ອນ ${outTime} ໂມງທ່ຽງ. ການເຂົ້າກ່ອນ ຫຼື ອອກຊ້າຂຶ້ນກັບສະພາບຫ້ອງວ່າງ ແລະ ອາດມີຄ່າບໍລິການເພີ່ມ.`,
      'ເມື່ອເຮັດຂັ້ນຕອນຮັບຫ້ອງ, ກະລຸນາສະແດງພາສປອດ, ບັດປະຈຳຕົວ ຫຼື ເອກະສານຢັ້ງຢືນຕົວຕົນທີ່ຖືກຕ້ອງຕາມກົດໝາຍ.',
      'ລູກຄ້າຍິນຍອມວາງເງິນມັດຈຳ (ຖ້າມີ) ເພື່ອຮັບປະກັນຄ່າໃຊ້ຈ່າຍເພີ່ມເຕີມລະຫວ່າງພັກເຊົາ; ເງິນມັດຈຳທີ່ເຫຼືອຈະຄືນໃຫ້ເມື່ອ Check-out.',
      'ເພື່ອຄວາມປອດໄພ, ກະລຸນາດູແລເດັກນ້ອຍຢ່າງໃກ້ຊິດໂດຍສະເພາະບໍລິເວນລະບຽງ, ຂັ້ນໄດ ແລະ ພື້ນທີ່ທຳມະຊາດອ້ອມຂ້າງ.',
      'ແຂກທີ່ມາຢ້ຽມຢາມຕ້ອງລົງທະບຽນຢູ່ເຄົາເຕີ້ຕ້ອນຮັບ ແລະ ສະແດງບັດປະຈຳຕົວ (ເວລາຢ້ຽມ 08:00–21:00). ຫ້າມຄ້າງຄືນໂດຍບໍ່ໄດ້ແຈ້ງ.',
      'ກະລຸນາຮັກສາຄວາມງຽບສະຫງົບ ແລະ ຫຼຸດສຽງລົບກວນແຂກຫ້ອງອື່ນ ໃນຊ່ວງເວລາ 22:00 ຫາ 07:00 ໂມງ.',
      'ເງິນສົດ, ເຄື່ອງປະດັບ ແລະ ຊັບສິນມີຄ່າກະລຸນາເກັບຮັກສາໃນຕູ້ນິລະໄພ ຫຼື ນຳຕິດຕົວ. ຣີສອດບໍ່ຮັບຜິດຊອບກໍລະນີສູນຫາຍ.',
      'ຫ້າມສູບຢາ (ລວມທັງຢາສູບໄຟຟ້າ), ຫ້າມຈູດທູບທຽນ ແລະ ຫ້າມນຳອາຫານກິ່ນແຮງ (ເຊັ່ນ: ຖົ່ວລຽນ, ປາແດກ) ເຂົ້າຫ້ອງພັກ. ຖ້າລະເມີດຈະມີຄ່າທຳຄວາມສະອາດ 500,000 ₭.',
      'ຫ້າມນຳວັດຖຸໄວໄຟ ຫຼື ສິ່ງຜິດກົດໝາຍເຂົ້າໃນຣີສອດຢ່າງເດັດຂາດ. ທຸກການເສຍຫາຍຂອງອຸປະກອນໃນຫ້ອງຈະຖືກຄິດຄ່າຊົດເຊີຍຕາມຄວາມເປັນຈິງ.',
      'ກະລຸນາສົ່ງຄືນກະແຈ/ຄີກາດຫ້ອງທີ່ເຄົາເຕີ້ຕອນ Check-out (ກໍລະນີເຮັດເສຍຈະມີຄ່າປັບໃໝ 100,000 ₭/ອັນ).',
    ],
  },
  en: {
    formTitle: 'RESORT BOOKING CONFIRMATION & REGISTRATION FORM',
    secBooking: 'Booking Information',
    secGuest: 'Guest Information',
    secPayment: 'Method of Payment',
    secTerms: 'Please Note / Terms & Conditions:',
    titlePrefix: 'Title',
    lastName: 'Last Name',
    firstName: 'First Name',
    bookingNo: 'Booking No.',
    roomNo: 'Room No.',
    roomType: 'Room Type',
    checkInDate: 'Arrival Date',
    guestCount: 'Guests',
    roomRate: 'Room Rate',
    checkOutDate: 'Departure Date',
    nights: 'Nights',
    flight: 'Flight / Vehicle',
    bookedVia: 'Company / Channel',
    prevStays: 'Previous Stays',
    notes: 'Remarks',
    address: 'Address',
    city: 'City',
    province: 'Province / State',
    email: 'Email',
    phone: 'Telephone',
    country: 'Country / Nationality',
    dob: 'Date of Birth',
    idNo: 'Passport / ID No.',
    payCash: 'Cash',
    payTransfer: 'Transfer',
    payQr: 'QR Code',
    payCard: 'Credit/Debit Card',
    payCompany: 'Company',
    noInvoice: 'No Invoice Required',
    balanceSummary: 'Payment Summary',
    adultsShort: '(A)',
    childrenShort: '(C)',
    agreeText: (hotelName) =>
      `By signing this registration card, I confirm that I have read, understood, and agreed to comply with all policies, rules, and regulations of ${hotelName}. I agree to settle all room charges and any incidental expenses incurred prior to departure.`,
    guestSigLabel: 'Guest Signature',
    staffSigLabel: 'Receptionist',
    signedAtLabel: 'Signed at',
    notSignedYet: '👉 Tap here to sign with finger',
    btnSignature: 'Signature',
    btnEditSignature: 'Edit Signature',
    rules: (inTime, outTime) => [
      `Check-in time is from ${inTime} and Check-out time is prior to ${outTime} noon. Early check-in or late check-out is subject to room availability and may incur additional charges.`,
      'Valid passport, national ID card, or government-issued photo ID is required for all arriving guests upon check-in.',
      'The resort may require a security deposit upon check-in to cover incidental charges; unused deposit will be refunded upon check-out.',
      'For safety, please supervise children at all times, especially on balconies, staircases, and surrounding natural areas.',
      'Visitors must register at the Reception Desk and present valid ID (visiting hours 08:00–21:00). Unregistered overnight guests are not permitted.',
      'Quiet hours are strictly observed from 22:00 to 07:00. Please respect the peace and comfort of other guests.',
      'Please secure cash, jewelry, and valuables in the room safe or keep them with you. The resort assumes no liability for lost or stolen items.',
      'Strictly NO SMOKING (including e-cigarettes), burning candles/incense, or strong-smelling food (such as durian) inside guest rooms. Violation penalty: 500,000 ₭.',
      'Flammable, hazardous, or illegal items are strictly prohibited. Guests are liable for any damage or loss of resort property.',
      'Room key / key card must be returned upon check-out (lost key replacement fee: 100,000 ₭).',
    ],
  },
};

export default function GuestBookingConfirmationPage({
  bookingId,
  encodedData,
  onGoHome,
  onGoLogin,
}) {
  const { rooms, bookings, hotelInfo, updateBooking } = useHotel();
  const { toast } = useToast();

  const [formLang, setFormLang] = useState('bi'); // 'bi' | 'lo' | 'en' | 'th' | 'vi'
  const [showSigPad, setShowSigPad] = useState(false);

  // Decode booking from URL param & fallback to storage
  const [bookingData, setBookingData] = useState(() => {
    // 1. Try decoding payload from URL &d=...
    const decoded = decodeBookingPayload(encodedData);
    if (decoded && decoded.id) {
      return decoded;
    }
    // 2. Try looking up in HotelContext / localStorage
    const local = bookings.find(b => b.id === bookingId);
    if (local) {
      return buildBookingPayload(local);
    }
    // 3. Fallback dummy placeholder
    return {
      id: bookingId || 'BK-ONLINE',
      guestName: 'ແຂກຜູ້ມີກຽດ',
      guestFirstName: 'ແຂກຜູ້ມີກຽດ',
      guestLastName: '',
      roomNumber: '101',
      roomType: 'standard',
      checkIn: new Date().toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      nights: 1,
      adults: 2,
      children: 0,
      totalAmount: 150000,
      deposit: 150000,
      remainingAmount: 0,
      paymentMethod: 'cash',
      status: 'booked',
      bookedByStaff: 'admin',
    };
  });

  const [signatureDataUrl, setSignatureDataUrl] = useState(
    () => bookingData?.signatureDataUrl || ''
  );
  const [signedAt, setSignedAt] = useState(
    () => bookingData?.signedAt || ''
  );

  // Sync when signature updates
  const handleSaveSignature = (dataUrl) => {
    setSignatureDataUrl(dataUrl);
    const nowIso = dataUrl ? new Date().toISOString() : '';
    setSignedAt(nowIso);
    setShowSigPad(false);

    // Save locally into bookingData
    const updated = {
      ...bookingData,
      signatureDataUrl: dataUrl,
      signedAt: nowIso,
    };
    setBookingData(updated);

    // Update in context & localStorage if booking exists
    if (bookingData?.id) {
      updateBooking(bookingData.id, {
        signatureDataUrl: dataUrl,
        signedAt: nowIso,
      });
    }

    if (dataUrl) {
      toast('✍️ ບັນທຶກລາຍເຊັນຂອງທ່ານສຳເລັດແລ້ວ! ທ່ານສາມາດກົດ "Save PDF" ເພື່ອດາວໂຫຼດໃບຢືນຢັນເກັບໄວ້ໄດ້ເລີຍ', 'success');
    }
  };

  // Find room object
  const roomObj = useMemo(() => {
    return rooms.find(r => r.id === bookingData?.roomId || r.number === bookingData?.roomNumber) || {
      number: bookingData?.roomNumber || '101',
      type: bookingData?.roomType || 'standard',
      price: bookingData?.roomPrice || 150000,
    };
  }, [rooms, bookingData]);

  // Labels
  const baseLang = formLang === 'bi' ? 'lo' : formLang;
  const T = FORM_TEXT[baseLang] || FORM_TEXT.lo;
  const TEN = FORM_TEXT.en;
  const biLabel = (key) => {
    if (formLang !== 'bi') return T[key];
    const lo = FORM_TEXT.lo[key];
    const en = FORM_TEXT.en[key];
    if (lo === en) return lo;
    return `${lo} / ${en}`;
  };

  const roomTypeLabel = useMemo(() => {
    const typeKey = (bookingData?.roomType || 'standard').toLowerCase();
    const entry = ROOM_TYPES_LABEL[typeKey] || { lo: typeKey, en: typeKey };
    if (formLang === 'bi') return `${entry.lo} / ${entry.en}`;
    return entry[baseLang] || entry.en;
  }, [bookingData?.roomType, formLang, baseLang]);

  const rulesList = useMemo(() => {
    const inTime = hotelInfo?.checkInTime || '14:00';
    const outTime = hotelInfo?.checkOutTime || '11:00';
    const rLo = FORM_TEXT.lo.rules(inTime, outTime);
    const rEn = FORM_TEXT.en.rules(inTime, outTime);
    const rCurrent = (FORM_TEXT[baseLang] || FORM_TEXT.lo).rules(inTime, outTime);

    return rLo.map((item, idx) => ({
      lo: item,
      en: rEn[idx] || '',
      main: rCurrent[idx] || item,
    }));
  }, [hotelInfo, baseLang]);

  const nights = Number(bookingData?.nights || 1);
  const totalAmount = Number(bookingData?.totalAmount || 0);
  const depositPaid = Number(bookingData?.deposit || 0);
  const remainingDue = Math.max(0, totalAmount - depositPaid);

  return (
    <div style={{ minHeight: '100vh', background: '#e2e8f0', color: '#1e293b', paddingBottom: '90px' }}>
      {/* Top Mobile Guest Navigation Header */}
      <header
        className="no-print"
        style={{
          background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
          color: '#fff',
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>🏨</span>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.3px' }}>
                  {hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · Tad Fane Resort
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  ເລກຈອງ: <strong>{bookingData?.id}</strong> · ຫ້ອງ {roomObj?.number} · {bookingData?.guestName}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Language Switcher */}
            <div className="reg-lang-group" style={{ background: 'rgba(255,255,255,0.15)', padding: '3px', borderRadius: '8px' }}>
              {[
                { key: 'bi', label: '🇱🇦+🇬🇧' },
                { key: 'lo', label: 'ລາວ' },
                { key: 'en', label: 'EN' },
                { key: 'th', label: 'ไทย' },
                { key: 'vi', label: 'VN' },
              ].map(l => (
                <button
                  key={l.key}
                  type="button"
                  className={`reg-lang-btn ${formLang === l.key ? 'active' : ''}`}
                  style={{
                    background: formLang === l.key ? '#fff' : 'transparent',
                    color: formLang === l.key ? '#1b4332' : '#fff',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setFormLang(l.key)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn"
              style={{
                background: '#fff',
                color: '#1b4332',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={() => window.print()}
            >
              <span>📥</span>
              <span>Save PDF</span>
            </button>

            {onGoLogin && (
              <button
                type="button"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                onClick={onGoLogin}
                title="ກັບຄືນສູ່ໜ້າພະນັກງານ (Login)"
              >
                🔐 ພະນັກງານ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Guest Mobile Action Notice Banner */}
      <div className="no-print" style={{ maxWidth: '980px', margin: '14px auto 0', padding: '0 14px' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '14px 18px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
            borderLeft: '5px solid #2d6a4f',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📄</span>
              <span>ໃບຢືນຢັນການຈອງຫ້ອງພັກ & ລົງທະບຽນຂອງທ່ານ</span>
              {signatureDataUrl ? (
                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  ✅ ເຊັນຊື່ແລ້ວ
                </span>
              ) : (
                <span style={{ background: '#ffedd5', color: '#c2410c', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  ✍️ ລໍຖ້າລາຍເຊັນ
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
              ທ່ານສາມາດກວດສອບຂໍ້ມູນ, ເຊັນຊື່ຢືນຢັນດ້ວຍນິ້ວມືຜ່ານໜ້າຈໍມືຖື ແລະ ກົດ <strong>"Save PDF"</strong> ເພື່ອໂຫຼດເກັບໄວ້ໃນໂທລະສັບຂອງທ່ານໄດ້ທັນທີ
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              style={{
                background: '#d96528',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(217,101,40,0.3)',
              }}
              onClick={() => setShowSigPad(true)}
            >
              ✍️ {signatureDataUrl ? 'ແກ້ໄຂລາຍເຊັນ' : 'ເຊັນຊື່ຢືນຢັນ'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '8px 14px', borderRadius: '8px' }}
              onClick={() => window.print()}
            >
              🖨️ ດາວໂຫຼດ PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Printable A4 Paper Pages (Page 1 & Page 2) */}
      <div className="reg-scroll-area" style={{ padding: '16px 10px', display: 'flex', justifyContent: 'center' }}>
        <div className="reg-printable reg-a4-stack" style={{ margin: '0 auto' }}>
          {/* ================= PAGE 1 OF 2: BOOKING, GUEST & PAYMENT ================= */}
          <div className="reg-paper reg-a4-page">
            <div className="reg-page-badge">📄 ໃບທີ 1 / 2</div>
            <div className="reg-paper-header">
              <div className="reg-hotel-brand">
                <div className="reg-hotel-name">
                  {hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · {hotelInfo?.nameEn || 'Tad Fane Resort'}
                </div>
                <div className="reg-hotel-meta">
                  {hotelInfo?.address} {hotelInfo?.phone ? `· Tel: ${hotelInfo.phone}` : ''}
                </div>
              </div>
              <h1 className="reg-doc-title">
                {formLang === 'bi'
                  ? 'ໃບຢືນຢັນການຈອງ & ລົງທະບຽນ / RESORT BOOKING CONFIRMATION & REGISTRATION FORM'
                  : T.formTitle}
              </h1>
            </div>

            {/* SECTION 1: BOOKING INFORMATION */}
            <div className="reg-section-heading">1. {biLabel('secBooking')}</div>
            <div className="reg-table">
              {/* Row 1: Title, Last Name, First Name */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('titlePrefix')}</span>
                  <div className="reg-cell-val">{bookingData?.guestTitle || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('lastName')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 600 }}>{bookingData?.guestLastName || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('firstName')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700 }}>
                    {bookingData?.guestFirstName || bookingData?.guestName || '—'}
                  </div>
                </div>
              </div>

              {/* Row 2: Booking No, Room No, Room Type */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell reg-cell-highlight">
                  <span className="reg-label">{biLabel('bookingNo')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 800, color: '#166534' }}>
                    {bookingData?.id || '—'}
                  </div>
                </div>
                <div className="reg-cell reg-cell-highlight">
                  <span className="reg-label">{biLabel('roomNo')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 800, color: '#0f172a' }}>
                    {roomObj?.number || '—'}
                  </div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('roomType')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 600 }}>
                    {roomTypeLabel}
                  </div>
                </div>
              </div>

              {/* Row 3: Check-in, Guests, Room Rate */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('checkInDate')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700 }}>{bookingData?.checkIn || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('guestCount')}</span>
                  <div className="reg-cell-val">
                    {bookingData?.adults || 2} {T.adultsShort} / {bookingData?.children || 0} {T.childrenShort}
                  </div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('roomRate')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700 }}>
                    {formatCurrency(roomObj?.price || bookingData?.roomPrice || 0)}
                  </div>
                </div>
              </div>

              {/* Row 4: Check-out, Nights, Flight */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('checkOutDate')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700 }}>{bookingData?.checkOut || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('nights')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700 }}>{nights}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('flight')}</span>
                  <div className="reg-cell-val">{bookingData?.flight || '—'}</div>
                </div>
              </div>

              {/* Row 5: Booked via, Prev stays, Remarks */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('bookedVia')}</span>
                  <div className="reg-cell-val">{bookingData?.bookingChannel || 'Walk-in'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('prevStays')}</span>
                  <div className="reg-cell-val">{bookingData?.prevStays || 0}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('notes')}</span>
                  <div className="reg-cell-val">{bookingData?.notes || '—'}</div>
                </div>
              </div>
            </div>

            {/* SECTION 2: GUEST INFORMATION */}
            <div className="reg-section-heading">2. {biLabel('secGuest')}</div>
            <div className="reg-table">
              {/* Row 1: Address, City, Province */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('address')}</span>
                  <div className="reg-cell-val">{bookingData?.guestAddress || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('city')}</span>
                  <div className="reg-cell-val">{bookingData?.guestCity || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('province')}</span>
                  <div className="reg-cell-val">{bookingData?.guestProvince || '—'}</div>
                </div>
              </div>

              {/* Row 2: Email, Phone, Country */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('email')}</span>
                  <div className="reg-cell-val">{bookingData?.guestEmail || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('phone')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 600 }}>{bookingData?.guestPhone || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('country')}</span>
                  <div className="reg-cell-val">{bookingData?.guestCountry || 'ລາວ'}</div>
                </div>
              </div>

              {/* Row 3: DOB, Passport / ID */}
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('dob')}</span>
                  <div className="reg-cell-val">{bookingData?.guestDob || '—'}</div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('idNo')}</span>
                  <div className="reg-cell-val" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                    {bookingData?.guestIdCard || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: METHOD OF PAYMENT & SUMMARY */}
            <div className="reg-section-heading">3. {biLabel('secPayment')}</div>
            <div className="reg-payment-section">
              <div className="reg-payment-methods">
                {[
                  { key: 'cash', label: biLabel('payCash') },
                  { key: 'transfer', label: biLabel('payTransfer') },
                  { key: 'qr', label: biLabel('payQr') },
                  { key: 'company', label: biLabel('payCompany') },
                ].map(pm => {
                  const isChecked = (bookingData?.paymentMethod || 'cash') === pm.key;
                  return (
                    <label key={pm.key} className="reg-checkbox-label" style={{ opacity: isChecked ? 1 : 0.6 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                      />
                      <span>{pm.label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Balance Summary Box */}
              <div className="reg-balance-summary">
                <div className="reg-balance-title">{biLabel('balanceSummary')}</div>
                <div className="reg-balance-row">
                  <span>ຍອດລວມ / Total Amount:</span>
                  <strong>{formatCurrency(totalAmount)}</strong>
                </div>
                <div className="reg-balance-row" style={{ color: '#166534' }}>
                  <span>ມັດຈຳແລ້ວ / Deposit Paid:</span>
                  <strong>{formatCurrency(depositPaid)}</strong>
                </div>
                <div className="reg-balance-row reg-balance-total">
                  <span>ຍອດຄ້າງຊຳລະ / Balance Due:</span>
                  <strong style={{ color: remainingDue > 0 ? '#b91c1c' : '#166534' }}>
                    {formatCurrency(remainingDue)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="reg-a4-footer">
              <span>{hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · ໃບທີ 1 / 2 (ຂໍ້ມູນການຈອງ & ລູກຄ້າ)</span>
              <span>ອ່ານຂໍ້ກຳນົດ ແລະ ເຊັນຊື່ໃນໃບທີ 2 / 2 →</span>
            </div>
          </div>

          {/* ================= PAGE 2 OF 2: RULES & SIGNATURES ================= */}
          <div className="reg-paper reg-a4-page reg-a4-page-2">
            <div className="reg-page-badge">📜 ໃບທີ 2 / 2</div>
            <div className="reg-paper-header">
              <div className="reg-hotel-brand">
                <div className="reg-hotel-name">
                  {hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · {hotelInfo?.nameEn || 'Tad Fane Resort'}
                </div>
                <div className="reg-hotel-meta">
                  ເລກຈອງ / Ref: <strong>{bookingData?.id}</strong> · ຫ້ອງ / Room: <strong>{roomObj?.number}</strong> · ລູກຄ້າ / Guest: <strong>{bookingData?.guestName || '—'}</strong>
                </div>
              </div>
              <h2 className="reg-doc-subtitle">
                {biLabel('secTerms')}
              </h2>
            </div>

            {/* SECTION 4: TERMS & CONDITIONS */}
            <ol className="reg-rules-list reg-rules-a4">
              {rulesList.map((rule, idx) => (
                <li key={idx}>
                  {formLang === 'bi' ? (
                    <>
                      <div>{rule.lo}</div>
                      <div className="reg-rule-en">{rule.en}</div>
                    </>
                  ) : (
                    <div>{rule.main}</div>
                  )}
                </li>
              ))}
            </ol>

            {/* AGREEMENT & SIGNATURE DISPLAY */}
            <div className="reg-agreement-box">
              {formLang === 'bi' ? (
                <>
                  <p>{FORM_TEXT.lo.agreeText(hotelInfo?.name || 'ຣີສອດຕາດຟານ')}</p>
                  <p style={{ marginTop: '4px', color: '#475569' }}>
                    {TEN.agreeText(hotelInfo?.nameEn || 'Tad Fane Resort')}
                  </p>
                </>
              ) : (
                <p>{T.agreeText(baseLang === 'en' ? (hotelInfo?.nameEn || 'Tad Fane Resort') : (hotelInfo?.name || 'ຣີສອດຕາດຟານ'))}</p>
              )}
            </div>

            <div className="reg-signatures-grid" style={{ marginTop: 'auto', paddingTop: '18px' }}>
              {/* Guest Signature Box (Interactive for mobile guest!) */}
              <div
                className="reg-signature-box"
                onClick={() => setShowSigPad(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setShowSigPad(true)}
                style={{
                  cursor: 'pointer',
                  border: signatureDataUrl ? '1.5px solid #86efac' : '2px dashed #f97316',
                  background: signatureDataUrl ? '#f0fdf4' : '#fff7ed',
                }}
              >
                <div className="reg-sig-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{biLabel('guestSigLabel')}</span>
                  <span style={{ fontSize: '0.72rem', color: signatureDataUrl ? '#166534' : '#ea580c', fontWeight: 700 }}>
                    {signatureDataUrl ? '✅ ແຕະເພື່ອແກ້ໄຂ' : '👉 ແຕະເພື່ອເຊັນຊື່'}
                  </span>
                </div>
                <div className="reg-sig-area" style={{ height: '96px' }}>
                  {signatureDataUrl ? (
                    <img src={signatureDataUrl} alt="Guest signature" className="reg-sig-img" style={{ maxHeight: '88px' }} />
                  ) : (
                    <span className="reg-sig-placeholder no-print" style={{ color: '#ea580c', fontWeight: 600 }}>
                      {T.notSignedYet}
                    </span>
                  )}
                </div>
                <div className="reg-sig-meta">
                  <span>{bookingData?.guestName || '____________________'}</span>
                  {signedAt && (
                    <span>
                      {T.signedAtLabel}: {new Date(signedAt).toLocaleString('en-GB', { hour12: false })}
                    </span>
                  )}
                </div>
              </div>

              {/* Staff Signature Box */}
              <div className="reg-signature-box reg-signature-staff">
                <div className="reg-sig-title">{biLabel('staffSigLabel')}</div>
                <div className="reg-sig-area" style={{ height: '96px' }}>
                  <span className="reg-staff-stamp">
                    {bookingData?.bookedByStaff || 'Receptionist'}
                  </span>
                </div>
                <div className="reg-sig-meta">
                  <span>{hotelInfo?.nameEn || 'Tad Fane Resort'}</span>
                  <span>{bookingData?.checkIn || new Date().toISOString().split('T')[0]}</span>
                </div>
              </div>
            </div>

            <div className="reg-a4-footer">
              <span>{hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · ໃບທີ 2 / 2 (ຂໍ້ກຳນົດ & ລາຍເຊັນ)</span>
              <span>ຂອບໃຈທີ່ໃຊ້ບໍລິການ / Thank you for staying with us</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Orange Signature Button on Mobile (Always accessible) */}
      <button
        type="button"
        className="reg-fab-signature no-print"
        onClick={() => setShowSigPad(true)}
      >
        <span>✍️</span>
        <span>{signatureDataUrl ? T.btnEditSignature : T.btnSignature}</span>
      </button>

      {/* Sticky Bottom Bar on Mobile */}
      <div
        className="reg-bottom-bar no-print"
        style={{
          boxShadow: '0 -4px 15px rgba(0,0,0,0.1)',
          background: '#fff',
          borderTop: '1px solid #cbd5e1',
        }}
      >
        <div className="reg-bottom-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            title="ດາວໂຫຼດໃບຢືນຢັນເກັບໄວ້ໃນໂທລະສັບ"
          >
            📥 Save PDF / ພິມ
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ fontWeight: 800, background: '#1b4332', border: 'none' }}
            onClick={() => {
              if (hotelInfo?.phone) {
                window.location.href = `tel:${hotelInfo.phone}`;
              } else {
                window.location.href = 'tel:+8562098663366';
              }
            }}
          >
            📞 ໂທຣີສອດ
          </button>

          {onGoHome && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600 }}
              onClick={onGoHome}
            >
              🏠 ໜ້າຫຼັກຣີສອດ
            </button>
          )}
        </div>
      </div>

      {/* Signature Canvas Modal */}
      {showSigPad && (
        <SignaturePadModal
          guestName={bookingData?.guestName}
          initialSignature={signatureDataUrl}
          labels={{
            title: `✍️ ${biLabel('guestSigLabel')}`,
            hint: 'ກະລຸນາເຊັນຊື່ດ້ວຍນິ້ວມືເທິງໜ້າຈໍໂທລະສັບຂອງທ່ານ',
            clear: baseLang === 'en' ? '🗑️ Clear' : '🗑️ ລ້າງ',
            undo: baseLang === 'en' ? '↩️ Undo' : '↩️ ຍ້ອນກັບ',
            cancel: baseLang === 'en' ? 'Cancel' : 'ຍົກເລີກ',
            save: baseLang === 'en' ? '✅ Save Signature' : '✅ ບັນທຶກລາຍເຊັນ',
          }}
          onSave={handleSaveSignature}
          onClose={() => setShowSigPad(false)}
        />
      )}
    </div>
  );
}
