import React, { useState, useEffect } from 'react';
import { Slider } from '@miblanchard/react-native-slider';

interface ReliableSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: any;
}

export default function ReliableSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  minimumTrackTintColor = '#2563eb',
  maximumTrackTintColor = '#334155',
  thumbTintColor = '#2563eb',
  style,
}: ReliableSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Sync with external value only when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const handleSlidingStart = () => {
    setIsDragging(true);
  };

  const handleValueChange = (values: number | number[]) => {
    const newValue = Array.isArray(values) ? values[0] : values;
    setLocalValue(newValue);
  };

  const handleSlidingComplete = (values: number | number[]) => {
    const newValue = Array.isArray(values) ? values[0] : values;
    setIsDragging(false);
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  return (
    <Slider
      containerStyle={style}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      value={localValue}
      onValueChange={handleValueChange}
      onSlidingStart={handleSlidingStart}
      onSlidingComplete={handleSlidingComplete}
      minimumTrackTintColor={minimumTrackTintColor}
      maximumTrackTintColor={maximumTrackTintColor}
      thumbTintColor={thumbTintColor}
    />
  );
}
