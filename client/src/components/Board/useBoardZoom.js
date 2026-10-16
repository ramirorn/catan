import { useCallback, useEffect, useRef, useState } from 'react';
import { setBoardBridge } from '../Effects/fxSignal';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD_PX = 5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Zoom (wheel, pinch, buttons) and pan (drag) for the board SVG, done by
 * moving the viewBox. The view lives in a ref and is written straight to the
 * <svg> once per animation frame, so gestures never re-render the board; React
 * state only changes when the zoom buttons' enabled state flips.
 * A drag swallows the click that ends it, so pieces aren't placed by accident;
 * a plain tap still clicks through.
 */
export function useBoardZoom(bounds) {
  const svgEl = useRef(null);
  // zoom factor + offset of the view centre from the board centre (board units)
  const viewRef = useRef({ zoom: 1, x: 0, y: 0 });
  const boundsRef = useRef(bounds);
  const frame = useRef(0);
  const movingTimer = useRef(0);
  // Only what the buttons / cursor need; updated on threshold changes
  const [zoomFlags, setZoomFlags] = useState({ canZoomIn: true, canZoomOut: false });

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const swallowClick = useRef(false);

  const viewBoxOf = useCallback((v) => {
    const b = boundsRef.current;
    const cx = b.minX + b.width / 2;
    const cy = b.minY + b.height / 2;
    const w = b.width / v.zoom;
    const h = b.height / v.zoom;
    return `${cx + v.x - w / 2} ${cy + v.y - h / 2} ${w} ${h}`;
  }, []);

  // Camera fly in progress (see focus): the viewBox stays put meanwhile
  const cine = useRef(null);

  const writeViewBox = useCallback(() => {
    frame.current = 0;
    const svg = svgEl.current;
    if (svg && !cine.current) svg.setAttribute('viewBox', viewBoxOf(viewRef.current));
  }, [viewBoxOf]);

  const clampView = useCallback(({ zoom, x, y }) => {
    const b = boundsRef.current;
    const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const maxX = (b.width / 2) * (1 - 1 / z);
    const maxY = (b.height / 2) * (1 - 1 / z);
    return { zoom: z, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  // Store a new view and paint it on the next frame
  const setView = useCallback(
    (next) => {
      const v = clampView(typeof next === 'function' ? next(viewRef.current) : next);
      viewRef.current = v;
      if (!frame.current) frame.current = requestAnimationFrame(writeViewBox);
      // Mark the board as moving so CSS can pause decorative animations
      const svg = svgEl.current;
      if (svg) {
        svg.classList.add('is-moving');
        clearTimeout(movingTimer.current);
        movingTimer.current = setTimeout(() => svg.classList.remove('is-moving'), 160);
      }
      const canZoomIn = v.zoom < MAX_ZOOM - 0.01;
      const canZoomOut = v.zoom > MIN_ZOOM + 0.01;
      setZoomFlags((f) => (f.canZoomIn === canZoomIn && f.canZoomOut === canZoomOut ? f : { canZoomIn, canZoomOut }));
    },
    [clampView, writeViewBox]
  );

  // New board size (e.g. switching map): keep the view inside it
  useEffect(() => {
    boundsRef.current = bounds;
    setView(viewRef.current);
  }, [bounds, setView]);

  // Camera move played for everyone (e.g. a city upgrade): fly to a board
  // point and back. Any gesture / zoom button cancels it and keeps the view
  // where it is, so it never fights the player.
  const stopCine = useCallback(() => {
    const c = cine.current;
    if (!c) return;
    cancelAnimationFrame(c.raf);
    cine.current = null;
    const svg = svgEl.current;
    if (svg) {
      // Commit wherever the fly got to as the real view (one repaint)
      svg.style.transform = '';
      svg.style.transformOrigin = '';
      svg.style.willChange = '';
      svg.classList.remove('is-moving');
      const vb = viewBoxOf(viewRef.current);
      if (svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    }
    const v = viewRef.current;
    const canZoomIn = v.zoom < MAX_ZOOM - 0.01;
    const canZoomOut = v.zoom > MIN_ZOOM + 0.01;
    setZoomFlags((f) => (f.canZoomIn === canZoomIn && f.canZoomOut === canZoomOut ? f : { canZoomIn, canZoomOut }));
  }, [viewBoxOf]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(movingTimer.current);
      if (cine.current) cancelAnimationFrame(cine.current.raf);
    },
    []
  );

  // Board point (SVG units) → client px, from the view in the ref (not the
  // painted attribute), so overlays anchored to the board never lag a frame
  const rectCache = useRef({ at: -1, rect: null });
  const screenOf = useCallback((v, rect, bx, by) => {
    const b = boundsRef.current;
    const vw = b.width / v.zoom;
    const vh = b.height / v.zoom;
    const vx = b.minX + b.width / 2 + v.x - vw / 2;
    const vy = b.minY + b.height / 2 + v.y - vh / 2;
    const s = Math.min(rect.width / vw, rect.height / vh);
    const ox = rect.left + (rect.width - vw * s) / 2;
    const oy = rect.top + (rect.height - vh * s) / 2;
    return { x: ox + (bx - vx) * s, y: oy + (by - vy) * s, s };
  }, []);

  const project = useCallback(
    (bx, by) => {
      const svg = svgEl.current;
      if (!svg) return null;
      // During a fly the element is transformed: use its rect from before
      let rect = cine.current?.rect;
      if (!rect) {
        const now = performance.now();
        const cache = rectCache.current;
        if (now - cache.at > 8 || !cache.rect) {
          cache.rect = svg.getBoundingClientRect();
          cache.at = now;
        }
        rect = cache.rect;
      }
      if (!rect.width || !rect.height) return null;
      return screenOf(viewRef.current, rect, bx, by);
    },
    [screenOf]
  );

  const unproject = useCallback((clientX, clientY) => {
    const p0 = project(0, 0);
    if (!p0) return null;
    return { x: (clientX - p0.x) / p0.s, y: (clientY - p0.y) / p0.s };
  }, [project]);

  const focus = useCallback(
    (bx, by, { inMs = 450, holdMs = 600, outMs = 450, zoom = 2.3 } = {}) => {
      stopCine();
      const b = boundsRef.current;
      const from = { ...viewRef.current };
      const to = clampView({
        zoom: Math.max(from.zoom, Math.min(MAX_ZOOM, zoom)),
        x: bx - (b.minX + b.width / 2),
        y: by - (b.minY + b.height / 2),
      });
      const svg = svgEl.current;
      if (!svg) return () => {};
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return () => {};
      const t0 = performance.now();
      const total = inMs + holdMs + outMs;
      const lz0 = Math.log(from.zoom);
      const lz1 = Math.log(to.zoom);
      // The fly is a composited transform of the SVG as painted for `from`
      // (no re-rasterising of the terrain art every frame); the view math is
      // the same as the viewBox's, so anchored overlays line up exactly
      const base = screenOf(from, rect, 0, 0);
      svg.classList.add('is-moving');
      svg.style.transformOrigin = '0 0';
      svg.style.willChange = 'transform';
      const paint = () => {
        const p = screenOf(viewRef.current, rect, 0, 0);
        const k = p.s / base.s;
        const tx = p.x - rect.left - k * (base.x - rect.left);
        const ty = p.y - rect.top - k * (base.y - rect.top);
        svg.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${k.toFixed(4)})`;
      };
      const step = () => {
        const t = performance.now() - t0;
        let k = 1;
        if (t < inMs) k = easeInOut(t / inMs);
        else if (t > inMs + holdMs) k = 1 - easeInOut(Math.min(1, (t - inMs - holdMs) / outMs));
        viewRef.current = clampView({
          zoom: Math.exp(lz0 + (lz1 - lz0) * k),
          x: from.x + (to.x - from.x) * k,
          y: from.y + (to.y - from.y) * k,
        });
        if (t >= total) {
          viewRef.current = clampView(from);
          stopCine();
          return;
        }
        paint();
        cine.current.raf = requestAnimationFrame(step);
      };
      cine.current = { raf: requestAnimationFrame(step), rect };
      return stopCine;
    },
    [clampView, stopCine, screenOf]
  );

  // Let the board animations anchor to / fly over this board
  useEffect(
    () => setBoardBridge({ mode: '2d', project, toBoard: unproject, focus }),
    [project, unproject, focus]
  );

  // Screen point → board coordinates (handles letterboxing of "meet")
  const toBoard = useCallback((clientX, clientY) => {
    const svg = svgEl.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  // Zoom keeping the board point p fixed on screen
  const zoomAt = useCallback((from, newZoom, p) => {
    const b = boundsRef.current;
    const c = { x: b.minX + b.width / 2, y: b.minY + b.height / 2 };
    const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    if (!p) return { ...from, zoom: z };
    const cx = c.x + from.x;
    const cy = c.y + from.y;
    const k = from.zoom / z;
    return { zoom: z, x: p.x + (cx - p.x) * k - c.x, y: p.y + (cy - p.y) * k - c.y };
  }, []);

  // Wheel needs a non-passive listener to stop the page from scrolling
  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      stopCine();
      // The CTM still reflects the last painted viewBox: flush a pending frame first
      if (frame.current) {
        cancelAnimationFrame(frame.current);
        writeViewBox();
      }
      const p = toBoard(e.clientX, e.clientY);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-clamp(dy, -240, 240) * 0.0015);
      setView((v) => zoomAt(v, v.zoom * factor, p));
    },
    [toBoard, zoomAt, setView, writeViewBox, stopCine]
  );

  // Callback ref: the <svg> appears only once the board exists
  const svgRef = useCallback(
    (node) => {
      const prev = svgEl.current;
      if (prev) prev.removeEventListener('wheel', onWheel);
      svgEl.current = node;
      if (node) {
        node.addEventListener('wheel', onWheel, { passive: false });
        node.setAttribute('viewBox', viewBoxOf(viewRef.current));
      }
    },
    [onWheel, viewBoxOf]
  );

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const svg = svgEl.current;
    const ctm = svg?.getScreenCTM();
    const unitsPerPx = ctm ? 1 / ctm.a : 1;
    if (pts.length === 1) {
      gesture.current = { type: 'pan', start: pts[0], from: viewRef.current, unitsPerPx, dragging: false };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture.current = {
        type: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        from: viewRef.current,
        anchor: toBoard(mid.x, mid.y),
      };
      swallowClick.current = true;
    }
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopCine();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.type === 'pan') {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (!g.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX || viewRef.current.zoom <= MIN_ZOOM) return;
        g.dragging = true;
        swallowClick.current = true;
        svgEl.current?.setPointerCapture?.(e.pointerId);
      }
      setView({ zoom: g.from.zoom, x: g.from.x - dx * g.unitsPerPx, y: g.from.y - dy * g.unitsPerPx });
    } else if (g.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setView(zoomAt(g.from, g.from.zoom * (dist / g.dist), g.anchor));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (swallowClick.current) {
        // The click event follows pointerup; clear the flag right after it
        setTimeout(() => {
          swallowClick.current = false;
        }, 0);
      }
    } else {
      startGesture();
    }
  };

  const onClickCapture = (e) => {
    if (swallowClick.current) {
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = false;
    }
  };

  const zoomBy = (factor) => {
    stopCine();
    setView((v) => zoomAt(v, v.zoom * factor, null));
  };
  const reset = () => {
    stopCine();
    setView({ zoom: 1, x: 0, y: 0 });
  };

  return {
    svgRef,
    canZoomIn: zoomFlags.canZoomIn,
    canZoomOut: zoomFlags.canZoomOut,
    zoomIn: () => zoomBy(1.35),
    zoomOut: () => zoomBy(1 / 1.35),
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}
