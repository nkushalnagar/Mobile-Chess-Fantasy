import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';

interface CustomSliderProps {
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

function CustomSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  minimumTrackTintColor = '#2563eb',
  maximumTrackTintColor = '#334155',
  thumbTintColor = '#2563eb',
  style,
}: CustomSliderProps) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const lastEmittedValue = useRef(value);
  
  // Update internal value when external value changes (but not during drag)
  useEffect(() => {
    if (!isDragging) {
      setInternalValue(value);
    }
  }, [value, isDragging]);
  
  const currentValue = isDragging ? internalValue : value;
  const range = maximumValue - minimumValue;
  const position = ((currentValue - minimumValue) / range) * sliderWidth;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      handleTouch(evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      handleTouch(evt.nativeEvent.locationX);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (internalValue !== lastEmittedValue.current) {
        onValueChange(internalValue);
        lastEmittedValue.current = internalValue;
      }
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  const handleTouch = (locationX: number) => {
    if (sliderWidth === 0) return;
    
    const clampedX = Math.max(0, Math.min(locationX, sliderWidth));
    const percentage = clampedX / sliderWidth;
    const rawValue = minimumValue + percentage * range;
    const steppedValue = Math.round(rawValue / step) * step;
    const finalValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    
    setInternalValue(finalValue);
  };

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        {/* Maximum track (background) */}
        <View
          style={[
            styles.trackSegment,
            styles.maximumTrack,
            { backgroundColor: maximumTrackTintColor },
          ]}
        />
        {/* Minimum track (filled portion) */}
        <View
          style={[
            styles.trackSegment,
            styles.minimumTrack,
            {
              backgroundColor: minimumTrackTintColor,
              width: sliderWidth > 0 ? `${(position / sliderWidth) * 100}%` : '0%',
            },
          ]}
        />
        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbTintColor,
              left: position - 10,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default CustomSlider;

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    height: 4,
    position: 'relative',
    width: '100%',
  },
  trackSegment: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  maximumTrack: {
    width: '100%',
  },
  minimumTrack: {
    zIndex: 1,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    top: -8,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
