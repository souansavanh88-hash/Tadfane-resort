import { useState, useMemo } from 'react';
import {
  generateBookingShareUrl,
  generateBookingShareMessage,
  DEFAULT_PUBLIC_URL,
  DEFAULT_LOCAL_IP,
  DEFAULT_LOCAL_PORT
} from '../utils/bookingShare';
import { useToast } from './ToastProvider';

export default function ShareBookingModal({
  booking,
  room,
  hotelInfo,
  onClose,
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [hostMode, setHostMode] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'current';
    }
    return 'wifi';
  });
  const [customHost, setCustomHost] = useState('');
  const [showHostSettings, setShowHostSettings] = useState(false);

  const activeHost = useMemo(() => {
    if (hostMode === 'wifi') {
      const port = window.location.port || DEFAULT_LOCAL_PORT;
      return `${window.location.protocol}//${DEFAULT_LOCAL_IP}:${port}`;
    }
    if (hostMode === 'current') {
      return window.location.origin;
    }
    if (hostMode === 'custom' && customHost.trim()) {
      return customHost.trim();
    }
    return window.location.origin;
  }, [hostMode, customHost]);

  const shareUrl = useMemo(() => {
    return generateBookingShareUrl(booking, room, activeHost);
  }, [booking, room, activeHost]);

  const shareMessage = useMemo(() => {
    return generateBookingShareMessage(booking, room, shareUrl, hotelInfo);
  }, [booking, room, shareUrl, hotelInfo]);

  const qrCodeUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast('📋 ກັອບປີ້ລິ້ງສຳເລັດແລ້ວ! ສາມາດສົ່ງໃຫ້ແຂກຜ່ານ LINE / WhatsApp ໄດ້ເລີຍ', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('ບໍ່ສາມາດກັອບປີ້ໄດ້ ກະລຸນາເລືອກແລ້ວ Copy ດ້ວຍຕົນເອງ', 'error');
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedMsg(true);
      toast('📋 ສຳເນົາຂໍ້ຄວາມພ້ອມລິ້ງສຳເລັດແລ້ວ!', 'success');
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      toast('ບໍ່ສາມາດກັອບປີ້ໄດ້', 'error');
    }
  };

  const handleOpenLine = () => {
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareMessage)}`;
    window.open(lineUrl, '_blank');
  };

  const handleOpenWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, '_blank');
  };

  const handlePreviewGuest = () => {
    window.open(shareUrl, '_blank');
  };

  return (
    <div
      className="sig-modal-overlay no-print"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 9999 }}
    >
      <div
        className="modal"
        style={{
          maxWidth: '560px',
          width: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
            color: '#fff',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📱</span>
              <span>ສົ່ງລິ້ງໃຫ້ລູກຄ້າໂຫຼດເຂົ້າໂທລະສັບ</span>
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>
              ເລກຈອງ: <strong>{booking?.id}</strong> · ຫ້ອງ {room?.number || booking?.roomNumber || '-'} · ແຂກ: {booking?.guestName || '-'}
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            style={{ color: '#fff', fontSize: '1.25rem', opacity: 0.8 }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* QR Code Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: '14px',
              padding: '16px 16px 14px',
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: '10px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                marginBottom: '10px',
              }}
            >
              <img
                src={qrCodeUrl}
                alt={`QR Code Booking ${booking?.id}`}
                style={{ width: '200px', height: '200px', display: 'block' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
              📷 ໃຫ້ແຂກໃຊ້ກ້ອງໂທລະສັບສະແກນ QR Code ນີ້
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              ເປີດເບິ່ງໃບຢືນຢັນ, ເຊັນຊື່ຜ່ານໜ້າຈໍມືຖື ແລະ Save PDF ເຂົ້າເຄື່ອງໄດ້ທັນທີ
            </div>
          </div>

          {/* Direct Link Section */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              🔗 ລິ້ງໂດຍກົງ (Direct Link):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f1f5f9',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  outline: 'none',
                }}
                onClick={(e) => e.target.select()}
              />
              <button
                type="button"
                className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                style={{ whiteSpace: 'nowrap', fontWeight: 700, minWidth: '130px' }}
                onClick={handleCopyLink}
              >
                {copied ? '✅ ກັອບປີ້ແລ້ວ!' : '📋 ກັອບປີ້ລິ້ງ'}
              </button>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            <button
              type="button"
              className="btn"
              style={{
                background: '#06c755',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
              onClick={handleOpenLine}
              title="ເປີດແບ່ງປັນໃນ LINE"
            >
              <span>💬</span>
              <span>ສົ່ງ LINE</span>
            </button>

            <button
              type="button"
              className="btn"
              style={{
                background: '#25d366',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
              onClick={handleOpenWhatsApp}
              title="ເປີດແບ່ງປັນໃນ WhatsApp"
            >
              <span>🟢</span>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontWeight: 700,
                padding: '10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
              onClick={handlePreviewGuest}
              title="ເປີດທົດລອງເບິ່ງໃນໜ້າແຂກ"
            >
              <span>🌐</span>
              <span>ເປີດເບິ່ງ</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{
              width: '100%',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.82rem',
              padding: '8px',
              fontWeight: 600,
              marginBottom: '12px',
            }}
            onClick={handleCopyMessage}
          >
            {copiedMsg ? '✅ ສຳເນົາຂໍ້ຄວາມພ້ອມລິ້ງແລ້ວ!' : '📋 ກັອບປີ້ຂໍ້ຄວາມສະຫຼຸບທັງໝົດພ້ອມລິ້ງ'}
          </button>

          {/* Network Host Settings Toggle (For changing Wi-Fi IP if needed) */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: '#64748b',
              }}
              onClick={() => setShowHostSettings(v => !v)}
            >
              <span>⚙️ ທີ່ຢູ່ເຄືອຂ່າຍ / Network Host: <strong>{activeHost}</strong></span>
              <span>{showHostSettings ? '▲ ເຊື່ອງ' : '▼ ຕັ້ງຄ່າ'}</span>
            </div>

            {showHostSettings && (
              <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: hostMode === 'wifi' ? 700 : 400, color: hostMode === 'wifi' ? '#166534' : 'inherit' }}>
                    <input
                      type="radio"
                      name="hostMode"
                      checked={hostMode === 'wifi'}
                      onChange={() => setHostMode('wifi')}
                    />
                    <span>📶 Wi-Fi ຣີສອດ ({DEFAULT_LOCAL_IP})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: hostMode === 'current' ? 700 : 400 }}>
                    <input
                      type="radio"
                      name="hostMode"
                      checked={hostMode === 'current'}
                      onChange={() => setHostMode('current')}
                    />
                    <span>💻 ເຄື່ອງຄອມພິວເຕີ້ ({window.location.hostname})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: hostMode === 'custom' ? 700 : 400 }}>
                    <input
                      type="radio"
                      name="hostMode"
                      checked={hostMode === 'custom'}
                      onChange={() => setHostMode('custom')}
                    />
                    <span>🌐 ໂດເມນ / ອອນລາຍ</span>
                  </label>
                </div>

                {hostMode === 'custom' && (
                  <input
                    type="text"
                    placeholder="e.g. http://192.168.1.50:5173 ຫຼື https://tadfane.resort.la"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                    }}
                  />
                )}
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
                  * ເພື່ອໃຫ້ໂທລະສັບລູກຄ້າເປີດໄດ້, ໂທລະສັບຕ້ອງເຊື່ອມຕໍ່ Wi-Fi ດຽວກັນກັບເຄື່ອງຄອມພິວເຕີ້.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            💡 ແຂກສາມາດເປີດເບິ່ງໄດ້ທັນທີໂດຍ <strong>ບໍ່ຕ້ອງ Login</strong>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
}
