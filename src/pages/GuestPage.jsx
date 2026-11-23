import { useState, useMemo } from 'react';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { ROOM_TYPES, AMENITIES_LIST, formatCurrency, daysBetween, otherServicesList } from '../data/initialData';
import { TRANSLATIONS, nationalitiesList } from '../data/translations';
import PrintReceipt from '../components/PrintReceipt';

// ກວດສອບວ່າຫ້ອງວ່າງໃນຊ່ວງວັນທີທີ່ເລືອກ
function isRoomAvailableForDates(room, bookings, checkIn, checkOut) {
  if (room.status !== 'available') return false;
  const conflicts = bookings.filter(b => {
    if (b.roomId !== room.id) return false;
    if (['cancelled', 'checked_out'].includes(b.status)) return false;
    return b.checkIn < checkOut && b.checkOut > checkIn;
  });
  return conflicts.length === 0;
}

// guestActivities are dynamically loaded from HotelContext state

export default function GuestPage({ onGoLogin }) {
  const { rooms, bookings, createBooking, hotelInfo, setHotelInfo, guestActivities, lang, changeLang: setLang, t } = useHotel();
  const { currentUser } = useAuth();
  const [mainTab, setMainTab] = useState('home'); // home | hotel | activities
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [editHistoryText, setEditHistoryText] = useState('');

  const getCustomDesc = (act) => {
    if (!act) return '';
    // Resolve based on active language code (lo, th, en, vi)
    if (lang === 'lo') {
      return (act.customDescriptionLo && act.customDescriptionLo.trim()) || act.customDescription || t(act.descKey);
    }
    if (lang === 'th') {
      return (act.customDescriptionTh && act.customDescriptionTh.trim()) || t(act.descKey);
    }
    if (lang === 'en') {
      return (act.customDescriptionEn && act.customDescriptionEn.trim()) || t(act.descKey);
    }
    if (lang === 'vi') {
      return (act.customDescriptionVi && act.customDescriptionVi.trim()) || t(act.descKey);
    }
    return t(act.descKey);
  };

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Search state for Rooms
  const [searchCheckIn, setSearchCheckIn] = useState('');
  const [searchCheckOut, setSearchCheckOut] = useState('');
  const [onlyAvailableFilter, setOnlyAvailableFilter] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  // Navigation state
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [view, setView] = useState('browse'); // browse | detail | booking | success | booking_activity
  const [imgIndex, setImgIndex] = useState(0);
  const [bookingResult, setBookingResult] = useState(null);

  // Check availability with dates if provided, else check room.status
  const isDatesSelected = Boolean(searchCheckIn && searchCheckOut && searchCheckIn < searchCheckOut);

  // Filtered rooms with availability flag
  const roomsWithAvailability = useMemo(() => {
    return rooms.map(room => {
      const isAvailable = isDatesSelected
        ? isRoomAvailableForDates(room, bookings, searchCheckIn, searchCheckOut)
        : room.status === 'available';
      return { ...room, isAvailableForSelectedDates: isAvailable };
    });
  }, [rooms, bookings, searchCheckIn, searchCheckOut, isDatesSelected]);

  const filteredRooms = useMemo(() => {
    let list = [...roomsWithAvailability];
    if (typeFilter !== 'all') {
      list = list.filter(r => r.type === typeFilter);
    }
    if (onlyAvailableFilter) {
      list = list.filter(r => r.isAvailableForSelectedDates);
    }
    return list.sort((a, b) =>
      String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
    );
  }, [roomsWithAvailability, typeFilter, onlyAvailableFilter]);

  const typeOptions = [...new Set(rooms.map(r => r.type))];

  const nights = isDatesSelected ? Math.max(1, daysBetween(searchCheckIn, searchCheckOut)) : 0;

  const handleSetQuickDate = (preset) => {
    const d1 = new Date();
    if (preset === 'today') {
      const inStr = d1.toISOString().split('T')[0];
      const outD = new Date(Date.now() + 86400000);
      const outStr = outD.toISOString().split('T')[0];
      setSearchCheckIn(inStr);
      setSearchCheckOut(outStr);
    } else if (preset === 'tomorrow') {
      const inD = new Date(Date.now() + 86400000);
      const inStr = inD.toISOString().split('T')[0];
      const outD = new Date(Date.now() + 86400000 * 2);
      const outStr = outD.toISOString().split('T')[0];
      setSearchCheckIn(inStr);
      setSearchCheckOut(outStr);
    } else if (preset === 'weekend') {
      // Find upcoming Saturday
      const day = d1.getDay(); // 0 is Sun, 6 is Sat
      const diffToSat = (6 - day + 7) % 7 || 7;
      const sat = new Date(d1.getTime() + diffToSat * 86400000);
      const sun = new Date(sat.getTime() + 86400000);
      setSearchCheckIn(sat.toISOString().split('T')[0]);
      setSearchCheckOut(sun.toISOString().split('T')[0]);
    }
  };

  const handleClearSearch = () => {
    setSearchCheckIn('');
    setSearchCheckOut('');
    setOnlyAvailableFilter(false);
    setTypeFilter('all');
  };

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactTargetItem, setContactTargetItem] = useState(null); // room or activity

  const lineContactId = (hotelInfo?.lineContact || '@tadfane').trim();
  const lineUrl = lineContactId.startsWith('http')
    ? lineContactId
    : `https://line.me/R/ti/p/~${lineContactId.replace('@', '')}`;

  const openContactLine = (item = null, e = null) => {
    if (e) e.stopPropagation();
    setContactTargetItem(item);
    setShowContactModal(true);
  };

  const handleBookRoomDirectly = (room, e) => {
    openContactLine(room, e);
  };

  const handleViewRoomDetail = (room) => {
    setSelectedRoom(room);
    setImgIndex(0);
    setView('detail');
  };

  const handleBookActivity = (act, e) => {
    openContactLine(act, e);
  };

  // ---- Professional portal helpers ----
  const DINE_IDS = ['cafe', 'restaurant', 'market'];
  const experienceActs = (guestActivities || []).filter(a => a.id !== 'resort' && !DINE_IDS.includes(a.id));
  const dineActs = (guestActivities || []).filter(a => DINE_IDS.includes(a.id));
  const roomPrices = rooms.map(r => Number(r.price) || 0).filter(p => p > 0);
  const minRoomPrice = roomPrices.length ? Math.min(...roomPrices) : 0;

  const scrollToTabs = () => {
    setTimeout(() => {
      const el = document.getElementById('gp-tabs');
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 30);
  };

  const goToTab = (tabId) => {
    setMainTab(tabId);
    scrollToTabs();
  };

  const goToRooms = () => {
    setMainTab('hotel');
    handleClearSearch();
    scrollToTabs();
  };

  const handleViewActivityDetail = (act, e) => {
    if (e) e.stopPropagation();
    setSelectedActivity(act);
    setView('activity_detail');
  };

  // ---- SUCCESS VIEW ----
  if (view === 'success') {
    return (
      <BookingSuccess
        booking={bookingResult}
        onBack={() => { setView('browse'); setSelectedRoom(null); setSelectedActivity(null); setBookingResult(null); }}
        onGoLogin={onGoLogin}
        t={t}
      />
    );
  }

  // ---- ROOM BOOKING FORM VIEW ----
  if (view === 'booking' && selectedRoom) {
    return (
      <GuestLayout hotelInfo={hotelInfo} onGoLogin={onGoLogin} lang={lang} setLang={setLang} t={t} mainTab={mainTab} setMainTab={setMainTab}>
        <GuestBookingForm
          room={selectedRoom}
          preCheckIn={searchCheckIn}
          preCheckOut={searchCheckOut}
          createBooking={createBooking}
          onBack={() => setView('browse')}
          onSuccess={(b) => { setBookingResult(b); setView('success'); }}
          t={t}
          lang={lang}
        />
      </GuestLayout>
    );
  }

  // ---- ACTIVITY BOOKING FORM VIEW ----
  if (view === 'booking_activity' && selectedActivity) {
    return (
      <GuestLayout hotelInfo={hotelInfo} onGoLogin={onGoLogin} lang={lang} setLang={setLang} t={t} mainTab={mainTab} setMainTab={setMainTab}>
        <ActivityBookingForm
          activity={selectedActivity}
          onBack={() => setView('browse')}
          onSuccess={(b) => { setBookingResult(b); setView('success'); }}
          t={t}
          lang={lang}
        />
      </GuestLayout>
    );
  }
  // ---- ACTIVITY DETAIL VIEW ----
  if (view === 'activity_detail' && selectedActivity) {
    const act = selectedActivity;
    return (
      <GuestLayout hotelInfo={hotelInfo} onGoLogin={onGoLogin} lang={lang} setLang={setLang} t={t} mainTab={mainTab} setMainTab={setMainTab}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('browse')} style={{ marginBottom: '16px' }}>
            ← {t('back')}
          </button>

          <div className="card" style={{ padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px' }}>
              <span style={{ fontSize: '3.5rem' }}>{act.emoji}</span>
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{act.label || t(act.id)}</h1>
                <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem', marginTop: '4px' }}>
                  {act.price !== null ? `${formatCurrency(act.price)} / ທ່ານ` : <span style={{ color: 'var(--success)' }}>{t('freeAdmission', { defaultValue: 'ເຂົ້າຊົມຟຣີ / ບໍ່ມີຄ່າບໍລິການ' })}</span>}
                </div>
              </div>
            </div>

            <div style={{
              width: '100%', height: '320px', background: 'rgba(66, 107, 78, 0.05)',
              borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '5rem', marginBottom: '24px', border: '1px solid var(--border)',
              backgroundImage: act.images && act.images.length > 0 ? `url(${act.images[0]})` : 'url("/tadfane.jpg")',
              backgroundSize: 'cover', backgroundPosition: 'center'
            }} />

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              📜 {t('description')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.975rem', marginBottom: '28px', textAlign: 'justify', whiteSpace: 'pre-line' }}>
              {getCustomDesc(act)}
            </p>

            {act.price !== null && act.bookingEnabled !== false && (
              <button
                className="btn btn-success btn-lg"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  background: '#06c755',
                  borderColor: '#06c755',
                  boxShadow: '0 4px 14px rgba(6, 199, 85, 0.3)',
                }}
                onClick={() => openContactLine(act)}
              >
                💬 ຕິດຕໍ່ຈອງຜ່ານ LINE
              </button>
            )}
          </div>
        </div>
      </GuestLayout>
    );
  }
  // ---- DETAIL VIEW ----
  if (view === 'detail' && selectedRoom) {
    const room = rooms.find(r => r.id === selectedRoom.id) || selectedRoom;
    const amenitiesEnabled = AMENITIES_LIST.filter(a => room.amenities?.[a.key]);
    const detailNights = nights || 1;
    const totalEstimate = room.price * detailNights;

    return (
      <GuestLayout hotelInfo={hotelInfo} onGoLogin={onGoLogin} lang={lang} setLang={setLang} t={t} mainTab={mainTab} setMainTab={setMainTab}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setView('browse'); setImgIndex(0); }} style={{ marginBottom: '16px' }}>
            ← {t('back')}
          </button>

          {/* Image carousel */}
          <div className="carousel" style={{ marginBottom: '12px', borderRadius: 'var(--radius-xl)' }}>
            {room.images && room.images.length > 0 ? (
              <>
                {room.images.map((img, i) => (
                  <img key={i} src={img} alt={`Room ${room.number}`}
                    className={`carousel-img ${i === imgIndex ? 'active' : ''}`} />
                ))}
                {room.images.length > 1 && (
                  <>
                    <button className="carousel-btn carousel-btn-prev" onClick={() => setImgIndex(i => (i - 1 + room.images.length) % room.images.length)}>‹</button>
                    <button className="carousel-btn carousel-btn-next" onClick={() => setImgIndex(i => (i + 1) % room.images.length)}>›</button>
                    <div className="carousel-dots">
                      {room.images.map((_, i) => (
                        <div key={i} className={`carousel-dot ${i === imgIndex ? 'active' : ''}`} onClick={() => setImgIndex(i)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="carousel-placeholder" style={{ fontSize: '5rem' }}>
                🛏️
                <span>{t('room')} {room.number}</span>
              </div>
            )}
          </div>

          {/* Thumbnails Row */}
          {room.images && room.images.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
              {room.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Room thumb ${i}`}
                  onClick={() => setImgIndex(i)}
                  style={{
                    width: '80px',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: i === imgIndex ? '3px solid var(--primary)' : '2px solid transparent',
                    opacity: i === imgIndex ? 1 : 0.6,
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {t('room')} {room.number}
              </h1>
              <p style={{ color: 'var(--primary-light)', fontWeight: 600, marginBottom: '12px' }}>
                {t(room.type)} · {t('floor')} {room.floor} · {room.size} · 👥 {t('capacity')}: {room.capacity || 2} {t('guests')}
              </p>
              {room.description && (
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
                  {t(room.description)}
                </p>
              )}
              {amenitiesEnabled.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    🌟 {t('amenities')}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {amenitiesEnabled.map(a => (
                      <div key={a.key} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{t(a.key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Price box */}
            <div style={{
              background: 'var(--bg-card)', border: '2px solid var(--primary)',
              borderRadius: 'var(--radius-xl)', padding: '24px',
              textAlign: 'center', minWidth: '210px',
              boxShadow: 'var(--shadow-glow)',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('pricePerNight')}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                {formatCurrency(room.price)}
              </div>
              {nights && (
                <>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0' }}>
                    × {nights} {t('nights')}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)', marginBottom: '4px' }}>
                    {formatCurrency(totalEstimate)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{t('total')}</div>
                </>
              )}
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  background: '#06c755',
                  borderColor: '#06c755',
                  boxShadow: '0 4px 14px rgba(6, 199, 85, 0.3)',
                }}
                onClick={() => openContactLine(room)}
              >
                💬 ຕິດຕໍ່ຈອງຜ່ານ LINE
              </button>
            </div>
          </div>
        </div>
      </GuestLayout>
    );
  }

  // ---- BROWSE VIEW ----
  return (
    <GuestLayout hotelInfo={hotelInfo} onGoLogin={onGoLogin} lang={lang} setLang={setLang} t={t} mainTab={mainTab} setMainTab={setMainTab}>

      {/* ===== HERO (Professional) ===== */}
      <section className="gp-hero">
        <div className="gp-hero-inner">
          <span className="gp-eyebrow">🌿 Eco Nature Resort</span>
          <h1 className="gp-hero-title">{hotelInfo?.name || 'ຣີສອດຕາດຟານ'}</h1>
          <p className="gp-hero-sub">{hotelInfo?.nameEn || 'Tad Fane Resort'}</p>
          {hotelInfo?.address && (
            <p className="gp-hero-address">📍 {hotelInfo.address}</p>
          )}
          <div className="gp-hero-actions">
            <button type="button" className="gp-btn gp-btn-gold" onClick={goToRooms}>
              🛏️ ເບິ່ງຫ້ອງພັກ & ລາຄາ
            </button>
            <button type="button" className="gp-btn gp-btn-line" onClick={() => openContactLine(null)}>
              💬 ຈອງຜ່ານ LINE
            </button>
          </div>
        </div>
      </section>

      {/* ===== QUICK INFO BAR ===== */}
      <div className="gp-infobar">
        <div className="gp-info-item clickable" onClick={goToRooms}>
          <span className="gp-info-icon">🛏️</span>
          <div>
            <div className="gp-info-label">ຫ້ອງພັກ</div>
            <div className="gp-info-value">
              {rooms.length} ຫ້ອງ{minRoomPrice > 0 ? ` · ເລີ່ມ ${formatCurrency(minRoomPrice)}` : ''}
            </div>
          </div>
        </div>
        <div className="gp-info-item">
          <span className="gp-info-icon">🕒</span>
          <div>
            <div className="gp-info-label">ເວລາເຂົ້າ - ອອກ</div>
            <div className="gp-info-value">
              {hotelInfo?.checkInTime || '14:00'} - {hotelInfo?.checkOutTime || '12:00'}
            </div>
          </div>
        </div>
        <div className="gp-info-item">
          <span className="gp-info-icon">📞</span>
          <div>
            <div className="gp-info-label">ໂທຫາພວກເຮົາ</div>
            <div className="gp-info-value">{hotelInfo?.phone || '-'}</div>
          </div>
        </div>
        <div className="gp-info-item clickable" onClick={() => openContactLine(null)}>
          <span className="gp-info-icon" style={{ background: 'rgba(6, 199, 85, 0.12)' }}>💬</span>
          <div>
            <div className="gp-info-label">LINE Official</div>
            <div className="gp-info-value" style={{ color: '#059669' }}>{lineContactId}</div>
          </div>
        </div>
      </div>

      {/* ===== MAIN NAVIGATION (sticky, single row) ===== */}
      <nav id="gp-tabs" className="gp-tabs">
        <button type="button" className={`gp-tab ${mainTab === 'home' ? 'active' : ''}`} onClick={() => goToTab('home')}>
          🏠 {t('aboutUs')}
        </button>
        <button type="button" className={`gp-tab ${mainTab === 'hotel' ? 'active' : ''}`} onClick={goToRooms}>
          🛏️ {t('resort')}
        </button>
        <span className="gp-tab-divider" />
        {experienceActs.map(act => (
          <button key={act.id} type="button" className={`gp-tab ${mainTab === act.id ? 'active' : ''}`} onClick={() => goToTab(act.id)}>
            {act.emoji} {t(act.id)}
          </button>
        ))}
        {dineActs.length > 0 && <span className="gp-tab-divider" />}
        {dineActs.map(act => (
          <button key={act.id} type="button" className={`gp-tab ${mainTab === act.id ? 'active' : ''}`} onClick={() => goToTab(act.id)}>
            {act.emoji} {t(act.id)}
          </button>
        ))}
      </nav>

      {/* ===== HOME TAB ===== */}
      {mainTab === 'home' && (
        <div>
          {/* Experiences */}
          <section className="gp-section">
            <div className="gp-section-head">
              <div>
                <span className="gp-section-eyebrow">ຫ້ອງພັກ & ກິດຈະກຳ</span>
                <h2 className="gp-section-title">ປະສົບການທີ່ລໍຖ້າທ່ານຢູ່ຕາດຟານ</h2>
                <p className="gp-section-sub">ກົດເລືອກລາຍການທີ່ສົນໃຈ ເພື່ອເບິ່ງລາຍລະອຽດ, ຮູບພາບ ແລະ ລາຄາ</p>
              </div>
              <button type="button" className="gp-link" onClick={goToRooms}>ເບິ່ງຫ້ອງພັກທັງໝົດ →</button>
            </div>

            <div className="gp-grid">
              {/* Resort rooms feature tile */}
              <div className="gp-tile gp-tile-feature" onClick={goToRooms}>
                <div className="gp-tile-media" style={{ backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(15,40,30,0.55) 100%), url("/tadfane.jpg")' }}>
                  {minRoomPrice > 0 && (
                    <span className="gp-tile-price">ເລີ່ມ {formatCurrency(minRoomPrice)} / ຄືນ</span>
                  )}
                </div>
                <div className="gp-tile-body">
                  <h3 className="gp-tile-title">🛏️ {t('resort')} ({rooms.length} ຫ້ອງ)</h3>
                  <p className="gp-tile-desc">{t('desc_resort')}</p>
                  <span className="gp-tile-more">ເບິ່ງຫ້ອງວ່າງ & ລາຄາ →</span>
                </div>
              </div>

              {experienceActs.map(act => {
                const img = act.images && act.images.length > 0 ? act.images[0] : null;
                return (
                  <div key={act.id} className="gp-tile" onClick={() => goToTab(act.id)}>
                    <div className="gp-tile-media" style={img ? { backgroundImage: `url(${img})` } : undefined}>
                      {!img && <span className="gp-tile-emoji">{act.emoji}</span>}
                      {act.price > 0 && (
                        <span className="gp-tile-price">{formatCurrency(act.price)} / ທ່ານ</span>
                      )}
                    </div>
                    <div className="gp-tile-body">
                      <h3 className="gp-tile-title">{act.emoji} {t(act.id)}</h3>
                      <p className="gp-tile-desc">{getCustomDesc(act)}</p>
                      <span className="gp-tile-more">ເບິ່ງລາຍລະອຽດ →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* About / History */}
          <section className="gp-section gp-about">
            <div className="gp-about-img" style={{ backgroundImage: 'url("/tadfane.jpg")' }} />
            <div className="gp-about-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <span className="gp-section-eyebrow">ກ່ຽວກັບພວກເຮົາ</span>
                  <h2 className="gp-section-title">{t('historyTitle')}</h2>
                </div>
                {!isEditingHistory && currentUser?.role === 'owner' && (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      let curText = '';
                      if (lang === 'lo') curText = hotelInfo?.customHistoryLo || t('historyContent');
                      else if (lang === 'th') curText = hotelInfo?.customHistoryTh || t('historyContent');
                      else if (lang === 'en') curText = hotelInfo?.customHistoryEn || t('historyContent');
                      else if (lang === 'vi') curText = hotelInfo?.customHistoryVi || t('historyContent');
                      else curText = hotelInfo?.customHistory || t('historyContent');
                      setEditHistoryText(curText);
                      setIsEditingHistory(true);
                    }}
                  >
                    ✏️ ແກ້ໄຂ
                  </button>
                )}
              </div>

              {isEditingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                  <textarea
                    className="form-textarea"
                    rows={8}
                    value={editHistoryText}
                    onChange={e => setEditHistoryText(e.target.value)}
                    style={{ width: '100%', fontSize: '1rem', lineHeight: '1.7', padding: '12px', borderRadius: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        const fieldMap = { lo: 'customHistoryLo', th: 'customHistoryTh', en: 'customHistoryEn', vi: 'customHistoryVi' };
                        const field = fieldMap[lang] || 'customHistory';
                        setHotelInfo({ ...hotelInfo, [field]: editHistoryText });
                        setIsEditingHistory(false);
                      }}
                    >
                      💾 ບັນທຶກ (Save)
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingHistory(false)}>
                      ຍົກເລີກ (Cancel)
                    </button>
                  </div>
                </div>
              ) : (
                <p className="gp-about-text">
                  {(() => {
                    if (lang === 'lo' && hotelInfo?.customHistoryLo) return hotelInfo.customHistoryLo;
                    if (lang === 'th' && hotelInfo?.customHistoryTh) return hotelInfo.customHistoryTh;
                    if (lang === 'en' && hotelInfo?.customHistoryEn) return hotelInfo.customHistoryEn;
                    if (lang === 'vi' && hotelInfo?.customHistoryVi) return hotelInfo.customHistoryVi;
                    return hotelInfo?.customHistory || t('historyContent');
                  })()}
                </p>
              )}
            </div>
          </section>

          {/* Dining & Services */}
          <section className="gp-section">
            <div className="gp-section-head">
              <div>
                <span className="gp-section-eyebrow">ອາຫານ & ບໍລິການ</span>
                <h2 className="gp-section-title">ອາຫານ, ເຄື່ອງດື່ມ ແລະ ສິ່ງອຳນວຍຄວາມສະດວກ</h2>
              </div>
            </div>

            {dineActs.length > 0 && (
              <div className="gp-grid" style={{ marginBottom: '18px' }}>
                {dineActs.map(act => {
                  const img = act.images && act.images.length > 0 ? act.images[0] : null;
                  return (
                    <div key={act.id} className="gp-tile" onClick={() => goToTab(act.id)}>
                      <div className="gp-tile-media" style={img ? { backgroundImage: `url(${img})` } : undefined}>
                        {!img && <span className="gp-tile-emoji">{act.emoji}</span>}
                        <span className="gp-tile-price free">
                          {t('freeAdmission', { defaultValue: 'ເຂົ້າຊົມຟຣີ' })}
                        </span>
                      </div>
                      <div className="gp-tile-body">
                        <h3 className="gp-tile-title">{act.emoji} {t(act.id)}</h3>
                        <p className="gp-tile-desc">{getCustomDesc(act)}</p>
                        <span className="gp-tile-more">ເບິ່ງລາຍລະອຽດ & ບັນຍາກາດ →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="gp-services">
              {otherServicesList.map(item => (
                <div key={item.key} className="gp-service">
                  <span className="gp-service-icon">{item.icon}</span>
                  <span>{t(item.key)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Call to action */}
          <section className="gp-cta">
            <div>
              <h3>ພ້ອມມາພັກຜ່ອນກັບພວກເຮົາແລ້ວບໍ?</h3>
              <p>ກວດສອບຫ້ອງວ່າງຕາມວັນທີ ແລ້ວຕິດຕໍ່ທີມງານຜ່ານ LINE ເພື່ອຢືນຢັນການຈອງໄດ້ທັນທີ</p>
            </div>
            <div className="gp-hero-actions">
              <button type="button" className="gp-btn gp-btn-gold" onClick={goToRooms}>📅 ກວດສອບຫ້ອງວ່າງ</button>
              <button type="button" className="gp-btn gp-btn-line" onClick={() => openContactLine(null)}>💬 LINE: {lineContactId}</button>
            </div>
          </section>
        </div>
      )}

      {/* ===== HOTEL ROOMS TAB ===== */}
      {mainTab === 'hotel' && (
        <>
          {/* Booking via LINE Notice Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #06c755 0%, #059669 100%)',
            color: '#fff',
            borderRadius: 'var(--radius-xl)',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 8px 24px rgba(6, 199, 85, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.5rem' }}>💬</span>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  ເບິ່ງລາຍລະອຽດຫ້ອງພັກທັງໝົດ ({rooms.length} ຫ້ອງ)
                </div>
                <div style={{ fontSize: '0.88rem', opacity: 0.95, marginTop: '3px' }}>
                  ທ່ານສາມາດເລືອກເບິ່ງຮູບພາບ ແລະ ລາຄາຫ້ອງພັກທັງໝົດດ້ານລຸ່ມ, ເມື່ອຕ້ອງການຈອງຫ້ອງພັກ ກະລຸນາກົດປຸ່ມ <strong>"ຕິດຕໍ່ຈອງຜ່ານ LINE"</strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-lg"
              style={{
                background: '#ffffff',
                color: '#06c755',
                fontWeight: 800,
                fontSize: '1rem',
                padding: '12px 24px',
                borderRadius: '50px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              onClick={() => openContactLine(null)}
            >
              🟢 ເປີດ LINE: {lineContactId}
            </button>
          </div>

          {/* Date Picker Bar to check room availability */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}>
            {/* Date Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>📅 ເລືອກວັນທີກວດສອບ:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ເຂົ້າ:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                  }}
                  value={searchCheckIn}
                  min={today}
                  onChange={(e) => {
                    const newIn = e.target.value;
                    setSearchCheckIn(newIn);
                    if (!searchCheckOut || searchCheckOut <= newIn) {
                      const d = new Date(newIn);
                      d.setDate(d.getDate() + 1);
                      setSearchCheckOut(d.toISOString().split('T')[0]);
                    }
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ອອກ:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                  }}
                  value={searchCheckOut}
                  min={searchCheckIn || today}
                  onChange={(e) => setSearchCheckOut(e.target.value)}
                />
              </div>
              {nights > 0 && (
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  background: 'rgba(24, 61, 45, 0.08)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                }}>
                  🌙 {nights} ຄືນ
                </span>
              )}
            </div>

            {/* Quick date presets & filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                  }}
                  onClick={() => handleSetQuickDate('today')}
                >
                  ມື້ນີ້
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                  }}
                  onClick={() => handleSetQuickDate('tomorrow')}
                >
                  ມື້ອື່ນ
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                  }}
                  onClick={() => handleSetQuickDate('weekend')}
                >
                  ທ້າຍອາທິດ
                </button>
                {isDatesSelected && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{
                      fontSize: '0.78rem',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      color: 'var(--danger)',
                    }}
                    onClick={handleClearSearch}
                    title="ລ້າງວັນທີ"
                  >
                    ✕ ລ້າງ
                  </button>
                )}
              </div>

              {/* Show Available Only Toggle */}
              <button
                type="button"
                className={`btn btn-xs ${onlyAvailableFilter ? 'btn-primary' : 'btn-outline-primary'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                onClick={() => setOnlyAvailableFilter(prev => !prev)}
              >
                <span>{onlyAvailableFilter ? '✓' : '○'}</span>
                ສະແດງສະເພາະຫ້ອງວ່າງ
              </button>
            </div>
          </div>

          {/* Type filter tabs */}
          <div className="filter-tabs" style={{ marginBottom: '16px' }}>
            <button className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>
              🏨 {t('allTypes')} <span className="filter-tab-count">{rooms.length}</span>
            </button>
            {typeOptions.map(type => {
              const count = rooms.filter(r => r.type === type).length;
              return (
                <button key={type} className={`filter-tab ${typeFilter === type ? 'active' : ''}`} onClick={() => setTypeFilter(type)}>
                  {t(type)} <span className="filter-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Rooms count indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            <div>
              ພົບເຫັນທັງໝົດ <strong>{filteredRooms.length}</strong> ຫ້ອງ
              {isDatesSelected && (
                <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '6px' }}>
                  (ຊ່ວງວັນທີ: {formatDateShort(searchCheckIn)} - {formatDateShort(searchCheckOut)})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ color: '#16a34a' }}>🟢 ຫ້ອງວ່າງ: {filteredRooms.filter(r => r.isAvailableForSelectedDates).length}</span>
              <span style={{ color: '#dc2626' }}>🔴 ບໍ່ວ່າງ: {filteredRooms.filter(r => !r.isAvailableForSelectedDates).length}</span>
            </div>
          </div>

          {/* ===== ALL ROOMS GRID (Compact & Easy to Browse) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(205px, 1fr))',
            gap: '14px',
          }}>
            {filteredRooms.map(room => (
              <GuestRoomCard
                key={room.id}
                room={room}
                isAvailable={room.isAvailableForSelectedDates}
                isDatesSelected={isDatesSelected}
                t={t}
                onViewDetail={() => handleViewRoomDetail(room)}
                onBook={(e) => handleBookRoomDirectly(room, e)}
              />
            ))}
          </div>
        </>
      )}

      {/* ===== DETAILED INDIVIDUAL ACTIVITY / SERVICE / TICKET VIEWS ===== */}
      {(guestActivities || []).some(act => act.id === mainTab) && (() => {
        const act = (guestActivities || []).find(a => a.id === mainTab);
        return (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card" style={{ padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px' }}>
                <span style={{ fontSize: '3.5rem' }}>{act.emoji}</span>
                <div>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{act.label || t(act.id)}</h1>
                  <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem', marginTop: '4px' }}>
                    {act.price !== null ? (act.price > 0 ? `${formatCurrency(act.price)} / ທ່ານ` : t('from') + ' 350.000 ₭') : <span style={{ color: 'var(--success)' }}>{t('freeAdmission', { defaultValue: 'ເຂົ້າຊົມຟຣີ / ບໍ່ມີຄ່າບໍລິການ' })}</span>}
                  </div>
                </div>
              </div>

              <div style={{
                width: '100%', height: '320px', background: 'rgba(66, 107, 78, 0.05)',
                borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '6rem', marginBottom: '24px', border: '1px solid var(--border)',
                backgroundImage: act.images && act.images.length > 0 ? `url(${act.images[0]})` : 'url("/tadfane.jpg")',
                backgroundSize: 'cover', backgroundPosition: 'center'
              }} />

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                📜 {t('description')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.975rem', marginBottom: '28px', textAlign: 'justify', whiteSpace: 'pre-line' }}>
                {getCustomDesc(act)}
              </p>

              {act.id === 'resort' ? (
                <button
                  className="btn btn-success btn-lg"
                  style={{ width: '100%', padding: '14px', fontWeight: 800, fontSize: '1.1rem' }}
                  onClick={() => { setMainTab('hotel'); handleClearSearch(); }}
                >
                  🛏️ {t('bookNow')}
                </button>
              ) : (act.price !== null && act.bookingEnabled !== false) ? (
                <button
                  className="btn btn-success btn-lg"
                  style={{ width: '100%', padding: '14px', fontWeight: 800, fontSize: '1.1rem' }}
                  onClick={() => handleBookActivity(act)}
                >
                  🎟️ {t('bookNow')}
                </button>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* LINE CONTACT MODAL */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)} style={{ zIndex: 1200 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'center', padding: '28px 24px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#06c755',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(6, 199, 85, 0.35)',
              color: '#fff',
            }}>
              💬
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              ຕິດຕໍ່ຈອງຫ້ອງພັກຜ່ານ LINE
            </h3>

            {contactTargetItem && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '0.9rem',
              }}>
                {contactTargetItem.number ? (
                  <>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
                      🏨 ຫ້ອງ {contactTargetItem.number}
                    </strong> ({t(contactTargetItem.type)})
                    <div style={{ color: 'var(--accent)', fontWeight: 800, marginTop: '2px' }}>
                      {formatCurrency(contactTargetItem.price)} / ຄືນ
                    </div>
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
                      {contactTargetItem.emoji} {contactTargetItem.label}
                    </strong>
                    {contactTargetItem.price && (
                      <div style={{ color: 'var(--accent)', fontWeight: 800, marginTop: '2px' }}>
                        {formatCurrency(contactTargetItem.price)} / ທ່ານ
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '20px' }}>
              ເພື່ອຄວາມສະດວກ ແລະ ວ່ອງໄວໃນການຢືນຢັນຫ້ອງພັກຕົວຈິງ, ກະລຸນາຕິດຕໍ່ຫາທີມງານຕ້ອນຮັບຂອງຣີສອດຕາດຟານ ຜ່ານຊ່ອງທາງ LINE ໄດ້ເລີຍ:
            </p>

            <div style={{
              background: '#f0fdf4',
              border: '2px dashed #86efac',
              borderRadius: 'var(--radius)',
              padding: '14px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>
                🟢 LINE Official / ID:
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803d', letterSpacing: '0.04em', marginTop: '2px' }}>
                {lineContactId}
              </div>
              {hotelInfo?.phone && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📞 ໂທສາຍດ່ວນ: <strong>{hotelInfo.phone}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-lg"
                style={{
                  background: '#06c755',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  padding: '14px',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(6, 199, 85, 0.35)',
                }}
              >
                💬 ກົດເຂົ້າໄປທີ່ LINE ດຽວນີ້
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '10px' }}
                onClick={() => setShowContactModal(false)}
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        </div>
      )}
    </GuestLayout>
  );
}

// ======= HELPER =======
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('lo-LA', { day: 'numeric', month: 'short' });
}

// ======= GUEST LAYOUT =======
function GuestLayout({ children, hotelInfo, onGoLogin, lang, setLang, t }) {
  const flags = { lo: '🇱🇦', th: '🇹🇭', en: '🇺🇸', vi: '🇻🇳', ko: '🇰🇷' };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <nav style={{
        background: 'rgba(24, 61, 45, 0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(232, 223, 208, 0.2)',
        padding: '0 24px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>🏨</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFF9F0' }}>
              {hotelInfo?.name || 'ຣີສອດຕາດຟານ'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#FFF9F0', opacity: 0.8 }}>{t('guestLocation')}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Multilingual Selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.15)' }}>
            {Object.keys(flags).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  background: lang === l ? 'var(--accent)' : 'transparent',
                  border: 'none', borderRadius: '4px',
                  width: '32px', height: '26px',
                  fontSize: '1.2rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                  opacity: lang === l ? 1 : 0.6
                }}
                type="button"
                title={l.toUpperCase()}
              >
                {flags[l]}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#FFF9F0', cursor: 'pointer' }} onClick={onGoLogin}>{t('staffLogin')}</button>
        </div>
      </nav>
      <div style={{ padding: '16px 20px', width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>{children}</div>
      <footer style={{
        textAlign: 'center', padding: '24px',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '48px',
      }}>
        <div>{hotelInfo?.name} © 2026</div>
        {hotelInfo?.phone && <div style={{ marginTop: '4px' }}>📞 {hotelInfo.phone}</div>}
      </footer>
    </div>
  );
}

// ======= ROOM CARD (Compact, Clean & Intuitive) =======
function GuestRoomCard({ room, isAvailable = true, isDatesSelected = false, t, onViewDetail, onBook }) {
  const amenitiesEnabled = AMENITIES_LIST.filter(a => room.amenities?.[a.key]).slice(0, 3);

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        padding: 0,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        border: isAvailable ? '1px solid var(--border)' : '1px solid rgba(220, 38, 38, 0.25)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        opacity: isAvailable ? 1 : 0.82,
      }}
      onClick={onViewDetail}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = isAvailable
          ? '0 6px 18px rgba(24, 61, 45, 0.12)'
          : '0 6px 18px rgba(220, 38, 38, 0.12)';
        e.currentTarget.style.borderColor = isAvailable ? 'var(--primary)' : 'var(--danger)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
        e.currentTarget.style.borderColor = isAvailable ? 'var(--border)' : 'rgba(220, 38, 38, 0.25)';
      }}
    >
      {/* Compact Image */}
      <div style={{
        height: '130px',
        background: 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {room.images && room.images.length > 0 ? (
          <img
            src={room.images[0]}
            alt={`Room ${room.number}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: isAvailable ? 'none' : 'grayscale(35%)',
            }}
          />
        ) : (
          <div style={{ fontSize: '3rem', opacity: 0.35 }}>🛏️</div>
        )}

        {/* Room Price Badge */}
        <div style={{
          position: 'absolute', bottom: '8px', right: '8px',
          background: 'rgba(24, 61, 45, 0.9)', backdropFilter: 'blur(6px)',
          color: '#facc15', padding: '3px 10px', borderRadius: '16px',
          fontSize: '0.82rem', fontWeight: 800,
        }}>
          {formatCurrency(room.price)}
        </div>

        {/* Status Badge */}
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          background: isAvailable ? 'rgba(22, 101, 52, 0.92)' : 'rgba(220, 38, 38, 0.92)',
          color: '#fff',
          padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>
          {isAvailable
            ? (isDatesSelected ? '🟢 ວ່າງ (ພ້ອມຈອງ)' : '🟢 ຫ້ອງວ່າງ')
            : (isDatesSelected ? '🔴 ບໍ່ວ່າງໃນວັນທີນີ້' : '🔴 ບໍ່ວ່າງ / ພັກຢູ່')}
        </div>
      </div>

      {/* Info Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            ຫ້ອງ {room.number}
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            ຊັ້ນ {room.floor}
          </span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 700 }}>
          {t(room.type)} · {room.size} · 👥 {room.capacity || 2} ທ່ານ
        </div>

        {/* Amenities Row */}
        {amenitiesEnabled.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            {amenitiesEnabled.map(a => (
              <span key={a.key} title={t(a.key)}>{a.icon}</span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '6px', marginTop: 'auto', paddingTop: '8px' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '6px 4px',
              fontSize: '0.74rem',
              fontWeight: 600,
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: '#f8fafc',
            }}
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
          >
            🖼️ ເບິ່ງຮູບ
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 8px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: isAvailable ? '#06c755' : '#64748b',
              color: '#fff',
              borderRadius: '6px',
              boxShadow: isAvailable ? '0 2px 6px rgba(6, 199, 85, 0.25)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onClick={onBook}
          >
            {isAvailable ? '💬 ຈອງ (LINE)' : '💬 ສອບຖາມ (LINE)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======= ROOM BOOKING FORM =======
function GuestBookingForm({ room, preCheckIn, preCheckOut, createBooking, onBack, onSuccess, t, lang }) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestNationality: nationalitiesList[lang]?.[0] || 'ລາວ', guestCount: 1,
    passportNo: '', dob: '', email: '', address: '',
    checkIn: preCheckIn || today,
    checkOut: preCheckOut || tomorrow,
    notes: '', paymentMethod: 'cash',
  });
  const [errors, setErrors] = useState({});

  const nights = Math.max(1, daysBetween(form.checkIn, form.checkOut));
  const totalAmount = room.price * nights;
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const validate = () => {
    const e = {};
    if (!form.guestName.trim()) e.guestName = 'Required / ຕ້ອງໃສ່';
    if (!form.guestPhone.trim()) e.guestPhone = 'Required / ຕ້ອງໃສ່';
    if (form.checkIn >= form.checkOut) e.checkOut = t('dateError');
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const booking = createBooking({
      ...form,
      passportNo: form.passportNo.trim().toUpperCase(),
      roomId: room.id,
      nights,
      roomPrice: room.price,
      totalAmount,
      remainingAmount: totalAmount,
      discount: 0,
      deposit: 0,
      guestCount: Number(form.guestCount),
      status: 'pending',
      bookingChannel: 'online',
    });
    onSuccess(booking);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
        ← {t('back')}
      </button>

      {/* Room summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(245,158,11,0.05))',
        border: '1px solid var(--primary)', borderRadius: 'var(--radius-xl)',
        padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center',
      }}>
        <div style={{ fontSize: '3rem' }}>🛏️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{t('room')} {room.number}</div>
          <div style={{ color: 'var(--primary-light)', fontSize: '0.875rem' }}>{t(room.type)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{nights} {t('nights')}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            👤 {t('guestInfo')}
          </div>
          <div className="form-group">
            <label className="form-label">{t('fullName')} <span className="required">*</span></label>
            <input className="form-input" placeholder={t('fullName')} value={form.guestName} onChange={e => set('guestName', e.target.value)} />
            {errors.guestName && <div className="form-error">{errors.guestName}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('phone')} <span className="required">*</span></label>
            <input className="form-input" placeholder="020 xxxx xxxx / Phone" type="tel" value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)} />
            {errors.guestPhone && <div className="form-error">{errors.guestPhone}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('nationality')}</label>
              <select className="form-select" value={form.guestNationality} onChange={e => set('guestNationality', e.target.value)}>
                {(nationalitiesList[lang] || nationalitiesList['lo']).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('guestCount')}</label>
              <input className="form-input" type="number" min="1" max="10" value={form.guestCount} onChange={e => set('guestCount', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🪪 ເລກບັດ / ພາສປອດ (ID / Passport)</label>
              <input className="form-input" placeholder="PA0209560..." value={form.passportNo} onChange={e => set('passportNo', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">🎂 ວັນເກີດ (Date of Birth)</label>
              <input className="form-input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">📧 Email</label>
              <input className="form-input" type="email" placeholder="name@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">📍 ທີ່ຢູ່ / ແຂວງ (Address)</label>
              <input className="form-input" placeholder="ບ້ານ / ເມືອງ / ແຂວງ..." value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
          <hr className="divider" />
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            📅 {t('checkIn')} - {t('checkOut')}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('checkIn')}</label>
              <input className="form-input" type="date" value={form.checkIn} min={today} onChange={e => set('checkIn', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('checkOut')}</label>
              <input className="form-input" type="date" value={form.checkOut} min={form.checkIn || today} onChange={e => set('checkOut', e.target.value)} />
              {errors.checkOut && <div className="form-error">{errors.checkOut}</div>}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(room.price)} × {nights} {t('nights')}</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <textarea className="form-textarea" placeholder={t('notes')} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <button type="submit" className="btn btn-success btn-lg" style={{ width: '100%', fontWeight: 800 }}>✅ {t('submitBooking')}</button>
        </div>
      </form>
    </div>
  );
}

// ======= ACTIVITY BOOKING FORM =======
function ActivityBookingForm({ activity, onBack, onSuccess, t, lang }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestNationality: nationalitiesList[lang]?.[0] || 'ລາວ',
    quantity: 1, date: today, notes: '', paymentMethod: 'cash',
  });
  const [errors, setErrors] = useState({});

  const totalAmount = activity.price * form.quantity;
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const validate = () => {
    const e = {};
    if (!form.guestName.trim()) e.guestName = 'Required / 確保填寫';
    if (!form.guestPhone.trim()) e.guestPhone = 'Required / 確保填寫';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Save activity booking to localStorage (simulating database write)
    const newBooking = {
      id: `AC-${Date.now()}`,
      activityId: activity.id,
      activityLabel: t(activity.id),
      price: activity.price,
      quantity: Number(form.quantity),
      totalAmount,
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      paymentMethod: form.paymentMethod,
      date: form.date,
      notes: form.notes,
      status: 'booked',
    };

    const saved = localStorage.getItem('activities_sales');
    const sales = saved ? JSON.parse(saved) : [];
    localStorage.setItem('activities_sales', JSON.stringify([newBooking, ...sales]));

    onSuccess(newBooking);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
        ← {t('back')}
      </button>

      {/* Activity summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(99,102,241,0.05))',
        border: '1px solid var(--success)', borderRadius: 'var(--radius-xl)',
        padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center',
      }}>
        <div style={{ fontSize: '3rem' }}>{activity.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{t(activity.id)}</div>
          <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.1rem', marginTop: '2px' }}>
            {formatCurrency(activity.price)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{form.quantity} ປີ້</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            👤 {t('guestInfo')}
          </div>
          <div className="form-group">
            <label className="form-label">{t('fullName')} <span className="required">*</span></label>
            <input className="form-input" placeholder={t('fullName')} value={form.guestName} onChange={e => set('guestName', e.target.value)} />
            {errors.guestName && <div className="form-error">{errors.guestName}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('phone')} <span className="required">*</span></label>
            <input className="form-input" placeholder="020 xxxx xxxx / Phone" type="tel" value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)} />
            {errors.guestPhone && <div className="form-error">{errors.guestPhone}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('nationality')}</label>
              <select className="form-select" value={form.guestNationality} onChange={e => set('guestNationality', e.target.value)}>
                {(nationalitiesList[lang] || nationalitiesList['lo']).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ຈຳນວນປີ້/ເທື່ອ</label>
              <input className="form-input" type="number" min="1" max="100" value={form.quantity} onChange={e => set('quantity', Number(e.target.value))} />
            </div>
          </div>
          <hr className="divider" />
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            📅 ວັນທີເຂົ້າຮ່ວມກິດຈະກຳ
          </div>
          <div className="form-group">
            <label className="form-label">ວັນທີ</label>
            <input className="form-input" type="date" value={form.date} min={today} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <textarea className="form-textarea" placeholder={t('notes')} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <button type="submit" className="btn btn-success btn-lg" style={{ width: '100%', fontWeight: 800 }}>✅ {t('submitBooking')}</button>
        </div>
      </form>
    </div>
  );
}

// ======= BOOKING SUCCESS =======
function BookingSuccess({ booking, onBack, onGoLogin, t }) {
  const { rooms } = useHotel();
  const room = rooms.find(r => r.id === booking?.roomId);
  const isActivity = booking?.id?.startsWith('AC-');
  const [payMethod, setPayMethod] = useState('card'); // 'qr' or 'card'
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [txnRef, setTxnRef] = useState('');

  const handlePay = (e) => {
    e.preventDefault();
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
      alert('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsPaid(true);
      setTxnRef('TXN-' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'));
    }, 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{
          width: '80px', height: '80px',
          background: 'linear-gradient(135deg, var(--success), #16a34a)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.5rem', margin: '0 auto 20px',
          boxShadow: '0 0 30px rgba(34,197,94,0.4)', animation: 'pulse 2s infinite',
        }}>✅</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('successTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{t('successSubtitle')}</p>
        <div className="card" style={{ textAlign: 'left', marginBottom: '20px' }}>
          {[
            { label: t('bookingNo'), value: booking?.id, style: { fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 } },
            { label: isActivity ? 'ກິດຈະກຳ' : 'ປະເພດຫ້ອງ', value: isActivity ? booking?.activityLabel : t(booking?.type) },
            { label: t('name'), value: booking?.guestName },
            { label: t('phone'), value: booking?.guestPhone },
            { label: t('total'), value: formatCurrency(booking?.totalAmount), style: { color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' } },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{row.label}</span>
              <span style={row.style || { fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Payment Details Section */}
        <div className="card" style={{
          textAlign: 'left',
          marginBottom: '20px',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💳 ການສຳລະເງິນ (Payment Method)
          </h3>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px', gap: '8px' }}>
            <button
              style={{
                flex: 1, padding: '8px', border: 'none', background: payMethod === 'qr' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: payMethod === 'qr' ? 'var(--primary-light)' : 'var(--text-muted)',
                fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
                borderBottom: payMethod === 'qr' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem'
              }}
              onClick={() => setPayMethod('qr')}
            >
              📱 ໂອນຜ່ານ QR Code
            </button>
            <button
              style={{
                flex: 1, padding: '8px', border: 'none', background: payMethod === 'card' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: payMethod === 'card' ? 'var(--primary-light)' : 'var(--text-muted)',
                fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
                borderBottom: payMethod === 'card' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem'
              }}
              onClick={() => setPayMethod('card')}
            >
              💳 ບັດເຄດິດ (Credit Card)
            </button>
          </div>
          
          {payMethod === 'qr' ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ຊ່ອງທາງການໂອນເງິນ:
                </p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  ທະນາຄານການຄ້າຕ່າງປະເທດລາວ (BCEL)
                </p>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ຊື່ບັນຊີ:
                </p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  ຣີສອດ ຕາດຟານ (Tad Fane Resort)
                </p>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ເລກບັນຊີ LAK:
                </p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-light)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                  160-12-00-01234567-001
                </p>
              </div>
              
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto' }}>
                <img 
                  src="/qr_code.jpg" 
                  alt="BCEL One QR Code" 
                  style={{ 
                    width: '145px', 
                    height: '145px', 
                    borderRadius: '12px', 
                    border: '3px solid var(--border)',
                    background: '#fff' 
                  }} 
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
                  ສະແກນເພື່ອຊຳລະເງິນ
                </span>
              </div>
            </div>
          ) : (
            <div>
              {isPaid ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '2.5rem', color: 'var(--success)', marginBottom: '10px' }}>🎉</div>
                  <h4 style={{ color: 'var(--success)', fontWeight: 800, marginBottom: '8px' }}>ຊຳລະເງິນສຳເລັດ! (Paid Successfully)</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ໝາຍເລກທຸລະກຳ (Transaction Ref):</p>
                  <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', display: 'inline-block' }}>{txnRef}</p>
                </div>
              ) : (
                <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ຊື່ເທິງບັດ (Cardholder Name)</label>
                    <input 
                      type="text" 
                      placeholder="JOHN DOE"
                      value={cardName}
                      onChange={e => setCardName(e.target.value.toUpperCase())}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ເລກບັດເຄດິດ (Card Number)</label>
                    <input 
                      type="text" 
                      placeholder="4000 1234 5678 9010"
                      maxLength="19"
                      value={cardNumber}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '');
                        let matches = v.match(/\d{4,16}/g);
                        let match = matches && matches[0] || '';
                        let parts = [];
                        for (let i=0, len=match.length; i<len; i+=4) {
                          parts.push(match.substring(i, i+4));
                        }
                        if (parts.length > 0) {
                          setCardNumber(parts.join(' '));
                        } else {
                          setCardNumber(v);
                        }
                      }}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ວັນໝົດອາຍຸ (Expiry Date)</label>
                      <input 
                        type="text" 
                        placeholder="MM/YY"
                        maxLength="5"
                        value={cardExpiry}
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length >= 2) {
                            setCardExpiry(v.slice(0, 2) + '/' + v.slice(2, 4));
                          } else {
                            setCardExpiry(v);
                          }
                        }}
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CVV</label>
                      <input 
                        type="password" 
                        placeholder="***"
                        maxLength="3"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '8px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    {isProcessing ? (
                      <>
                        <span style={{ 
                          width: '16px', 
                          height: '16px', 
                          border: '2px solid #fff', 
                          borderTop: '2px solid transparent', 
                          borderRadius: '50%', 
                          animation: 'spin 1s linear infinite',
                          display: 'inline-block'
                        }}></span>
                        ກຳລັງປະມວນຜົນ...
                      </>
                    ) : (
                      `ຢືນຢันຊຳລະເງິນ (${formatCurrency(booking?.totalAmount)})`
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {payMethod === 'qr' && (
            <div style={{ 
              marginTop: '16px', 
              padding: '10px 12px', 
              background: 'rgba(234, 179, 8, 0.1)', 
              borderLeft: '4px solid var(--warning)', 
              borderRadius: '4px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              ⚠️ <strong>ໝາຍເຫດ:</strong> ກະລຸນາສົ່ງໃບບິນການໂອນ (Slip) ໃຫ້ພະນັກງານເພື່ອຢືນຢັນການຈອງ ຫຼັງຈາກການສຳລະເງິນສຳເລັດ.
            </div>
          )}
        </div>

        <div className="alert alert-info" style={{ marginBottom: '20px', textAlign: 'left' }}>
          ℹ️ {t('successAlert')} (<strong>{booking?.guestPhone}</strong>)
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onBack} style={{ flex: 1 }}>{t('bookOther')}</button>
          <button className="btn btn-outline-primary" onClick={() => window.print()} style={{ flex: 1 }}>{t('printConfirm')}</button>
        </div>

        {/* Hidden printable receipt for room booking */}
        {!isActivity && (
          <div className="receipt-printable">
            <PrintReceipt booking={booking} room={room} type="checkin" paidAmount={booking?.deposit || booking?.totalAmount} payMethod={booking?.payMethod || 'cash'} />
          </div>
        )}

        {/* Hidden printable receipt for activity booking */}
        {isActivity && (
          <div className="receipt-printable">
            <div className="receipt" id="receipt-content">
              <div className="receipt-header">
                <div className="receipt-hotel">ຣີສອດຕາດຟານ</div>
                <div style={{ marginTop: '6px', fontWeight: 'bold', fontSize: '15px' }}>
                  ====[ ໃບຢືນຢັນການຈອງກິດຈະກຳ ]====
                </div>
              </div>
              <hr className="receipt-divider" />
              <div className="receipt-row"><span>ເລກທີ:</span><span style={{ fontWeight: 'bold' }}>{booking?.id}</span></div>
              <div className="receipt-row"><span>ລູກຄ້າ:</span><span>{booking?.guestName}</span></div>
              <div className="receipt-row"><span>ເບີໂທ:</span><span>{booking?.guestPhone}</span></div>
              <hr className="receipt-divider" />
              <div className="receipt-row"><span>ກິດຈະກຳ:</span><span>{booking?.activityLabel}</span></div>
              <div className="receipt-row"><span>ວັນທີ:</span><span>{booking?.date}</span></div>
              <div className="receipt-row"><span>ຈຳນວນຜູ້ເຂົ້າຮ່ວມ:</span><span>{booking?.participants} ທ່ານ</span></div>
              <hr className="receipt-divider" />
              <div className="receipt-row receipt-total">
                <span>ຍອດລວມ</span>
                <span>{formatCurrency(booking?.totalAmount)}</span>
              </div>
              <hr className="receipt-divider" />
              <div className="receipt-footer">
                <div>ຂອບໃຈທີ່ໃຊ້ບໍລິການ!</div>
                <div>Thank you for your booking!</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
