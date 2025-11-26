import React from 'react';
import Svg, { Line, Circle } from 'react-native-svg';

interface SlidersIconProps {
  size?: number;
  color?: string;
}

export default function SlidersIcon({ size = 24, color = '#fff' }: SlidersIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top slider */}
      <Line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="6" r="3" fill="none" stroke={color} strokeWidth="2" />
      
      {/* Middle slider */}
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="8" cy="12" r="3" fill="none" stroke={color} strokeWidth="2" />
      
      {/* Bottom slider */}
      <Line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="16" cy="18" r="3" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}
