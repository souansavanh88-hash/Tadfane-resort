import { useEffect, useRef, useState, useCallback } from 'react';

export default function SignaturePadModal({
  guestName = '',
  initialSignature = '',
  labels = {},
  onSave,
  onClose,
}) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]); // Array<Array<{x, y}>>
  const activeStrokeRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [showingExisting, setShowingExisting] = useState(Boolean(initialSignature));

  const title = labels.title || '✍️ ລາຍເຊັນຜູ້ເຂົ້າພັກ / Guest Signature';
  const hint = labels.hint || 'ກະລຸນາເຊັນຊື່ດ້ວຍນິ້ວມື ຫຼື Apple Pencil ໃນກອບດ້ານລຸ່ມ';
  const clearLabel = labels.clear || '🗑️ ລ້າງ';
  const undoLabel = labels.undo || '↩️ ຍ້ອນກັບ';
  const cancelLabel = labels.cancel || 'ຍົກເລີກ';
  const saveLabel = labels.save || '✅ ບັນທຶກລາຍເຊັນ';

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;

    const allStrokes = activeStrokeRef.current
      ? [...strokesRef.current, activeStrokeRef.current]
      : strokesRef.current;

    for (const stroke of allStrokes) {
      if (!stroke || stroke.length === 0) continue;
      ctx.beginPath();
      if (stroke.length === 1) {
        ctx.arc(stroke[0].x, stroke[0].y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        continue;
      }
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const midX = (stroke[i].x + stroke[i + 1].x) / 2;
        const midY = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(redraw);
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [redraw]);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (showingExisting) {
      setShowingExisting(false);
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const pt = getPoint(e);
    activeStrokeRef.current = [pt];
    redraw();
  };

  const handlePointerMove = (e) => {
    if (!drawingRef.current || !activeStrokeRef.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    const prev = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    if (dx * dx + dy * dy < 1.5) return;
    activeStrokeRef.current.push(pt);
    redraw();
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (activeStrokeRef.current && activeStrokeRef.current.length > 0) {
      strokesRef.current.push(activeStrokeRef.current);
      setHasStrokes(true);
    }
    activeStrokeRef.current = null;
    redraw();
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setHasStrokes(false);
    setShowingExisting(false);
    redraw();
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setHasStrokes(strokesRef.current.length > 0);
    redraw();
  };

  const handleSave = () => {
    if (showingExisting && !hasStrokes && initialSignature) {
      onSave(initialSignature);
      return;
    }
    if (strokesRef.current.length === 0) {
      onSave('');
      return;
    }
    redraw();
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div
      className="sig-modal-overlay no-print"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sig-modal">
        <div className="sig-modal-header">
          <div>
            <div style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a' }}>{title}</div>
            {guestName && (
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>
                👤 {guestName}
              </div>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="sig-modal-body">
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>
            {hint}
          </div>

          <div className="sig-canvas-wrap">
            {showingExisting && initialSignature && !hasStrokes && (
              <img
                src={initialSignature}
                alt="Saved signature"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  padding: '16px',
                }}
              />
            )}

            {!hasStrokes && !showingExisting && (
              <div className="sig-canvas-placeholder">
                <span>✍️ Sign here / ເຊັນບ່ອນນີ້</span>
              </div>
            )}

            <div className="sig-canvas-baseline" />

            <canvas
              ref={canvasRef}
              className="sig-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            />
          </div>
        </div>

        <div className="sig-modal-footer">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: '1px solid #cbd5e1', color: '#334155' }}
              onClick={handleClear}
            >
              {clearLabel}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: '1px solid #cbd5e1', color: '#334155' }}
              onClick={handleUndo}
              disabled={!hasStrokes}
            >
              {undoLabel}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn btn-lg"
              style={{
                background: '#d96528',
                color: '#fff',
                fontWeight: 800,
                padding: '11px 24px',
                boxShadow: '0 4px 12px rgba(217, 101, 40, 0.35)',
              }}
              onClick={handleSave}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
