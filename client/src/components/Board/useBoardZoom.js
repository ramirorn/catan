import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD_PX = 5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Zoom (wheel, pinch, buttons) and pan (drag) for the board SVG, done by
 * moving the viewBox. A drag swallows the click that ends it, so pieces
 * aren't placed by accident; a plain tap still clicks through.
 */
export function useBoardZoom(bounds) {
  const svgRef = useRef(null);
  // zoom factor + offset of the view centre from the board centre (board units)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const swallowClick = useRef(false);

  const clampView = useCallback(
    ({ zoom, x, y }) => {
      const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      const maxX = (bounds.width / 2) * (1 - 1 / z);
      const maxY = (bounds.height / 2) * (1 - 1 / z);
      return { zoom: z, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    },
    [bounds.width, bounds.height]
  );

  // Screen point → board coordinates (handles letterboxing of "meet")
  const toBoard = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const boardCenter = useCallback(
    () => ({ x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 }),
    [bounds.minX, bounds.minY, bounds.width, bounds.height]
  );

  // Zoom keeping the board point p fixed on screen
  const zoomAt = useCallback(
    (from, newZoom, p) => {
      const c = boardCenter();
      const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
      if (!p) return clampView({ ...from, zoom: z });
      const cx = c.x + from.x;
      const cy = c.y + from.y;
      const k = from.zoom / z;
      return clampView({ zoom: z, x: p.x + (cx - p.x) * k - c.x, y: p.y + (cy - p.y) * k - c.y });
    },
    [boardCenter, clampView]
  );

  // Wheel needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toBoard(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomAt(v, v.zoom * factor, p));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toBoard, zoomAt]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const svg = svgRef.current;
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
        svgRef.current?.setPointerCapture?.(e.pointerId);
      }
      setView(clampView({ zoom: g.from.zoom, x: g.from.x - dx * g.unitsPerPx, y: g.from.y - dy * g.unitsPerPx }));
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

  const zoomBy = (factor) => setView((v) => zoomAt(v, v.zoom * factor, null));
  const reset = () => setView({ zoom: 1, x: 0, y: 0 });

  const c = boardCenter();
  const w = bounds.width / view.zoom;
  const h = bounds.height / view.zoom;
  const viewBox = `${c.x + view.x - w / 2} ${c.y + view.y - h / 2} ${w} ${h}`;

  return {
    svgRef,
    viewBox,
    zoom: view.zoom,
    canZoomIn: view.zoom < MAX_ZOOM - 0.01,
    canZoomOut: view.zoom > MIN_ZOOM + 0.01,
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
