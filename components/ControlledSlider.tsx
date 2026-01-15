import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface ControlledSliderProps {
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

export default function ControlledSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  minimumTrackTintColor = '#2563eb',
  maximumTrackTintColor = '#334155',
  thumbTintColor = '#2563eb',
  style,
}: ControlledSliderProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [sliderKey, setSliderKey] = useState(0);

  // Update internal value and force remount when external value changes
  useEffect(() => {
    if (Math.abs(internalValue - value) > 0.5) {
      setInternalValue(value);
      setSliderKey(prev => prev + 1);
    }
  }, [value]);

  const handleValueChange = (newValue: number) => {
    setInternalValue(newValue);
    onValueChange(newValue);
  };

  return (
    <View style={styles.container}>
      <Slider
        key={`slider-${sliderKey}-${value}`}
        style={style}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={internalValue}
        onValueChange={handleValueChange}
        minimumTrackTintColor={minimumTrackTintColor}
        maximumTrackTintColor={maximumTrackTintColor}
        thumbTintColor={thumbTintColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
