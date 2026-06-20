import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';

// A dependency-free horizontal slider. Built on PanResponder + plain Views so it
// adds no native module (nothing new for EAS to autolink / break). Snaps to
// `step`, clamps to [min, max]. `onChange` fires live while dragging (for the
// readout); `onComplete` fires once on release (commit to storage).
const THUMB = 22;

export default function LimitSlider({ value, min = 15, max = 480, step = 15, onChange, onComplete }) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const trackXRef = useRef(0); // track's absolute screen-x, for move math
  const valueRef = useRef(value);
  valueRef.current = value;
  const trackRef = useRef(null);

  const snap = (v) => {
    const s = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, s));
  };

  // Map an absolute screen x to a snapped value.
  const fromAbsX = (absX) => {
    const w = trackWRef.current || 1;
    const ratio = Math.max(0, Math.min(1, (absX - trackXRef.current) / w));
    return snap(min + ratio * (max - min));
  };

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackXRef.current = x;
      trackWRef.current = w;
      setTrackW(w);
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only claim the gesture for horizontal drags, so the parent ScrollView
      // keeps vertical scrolling.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (_e, g) => onChange?.(fromAbsX(g.x0)),
      onPanResponderMove: (_e, g) => {
        const v = fromAbsX(g.moveX);
        if (v !== valueRef.current) onChange?.(v);
      },
      onPanResponderRelease: () => onComplete?.(valueRef.current),
      onPanResponderTerminate: () => onComplete?.(valueRef.current),
    })
  ).current;

  const ratio = (Math.max(min, Math.min(max, value)) - min) / (max - min);
  const fillW = trackW * ratio;
  const thumbLeft = Math.max(0, Math.min(trackW - THUMB, fillW - THUMB / 2));

  return (
    <View ref={trackRef} onLayout={measure} style={s.track} {...pan.panHandlers}>
      <View style={s.barBg} />
      <View style={[s.fill, { width: fillW }]} />
      <View style={[s.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: 30, justifyContent: 'center' },
  barBg: { position: 'absolute', left: 0, right: 0, top: 13, height: 4, borderRadius: 2, backgroundColor: '#1a1a1a' },
  fill: { position: 'absolute', left: 0, top: 13, height: 4, borderRadius: 2, backgroundColor: '#7c3aed' },
  thumb: {
    position: 'absolute', top: 4, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: '#7c3aed', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
});
