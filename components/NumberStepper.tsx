import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface NumberStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  label?: string;
  color?: string;
  style?: any;
}

export default function NumberStepper({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  label,
  color = '#2563eb',
  style,
}: NumberStepperProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef(value);
  
  // Keep valueRef in sync
  valueRef.current = value;

  const handleDecrement = useCallback(() => {
    const currentValue = valueRef.current;
    const newValue = Math.max(minimumValue, currentValue - step);
    if (newValue !== currentValue) {
      onValueChange(newValue);
    }
  }, [minimumValue, step, onValueChange]);

  const handleIncrement = useCallback(() => {
    const currentValue = valueRef.current;
    const newValue = Math.min(maximumValue, currentValue + step);
    if (newValue !== currentValue) {
      onValueChange(newValue);
    }
  }, [maximumValue, step, onValueChange]);

  const startDecrement = useCallback(() => {
    handleDecrement();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        handleDecrement();
      }, 100);
    }, 500);
  }, [handleDecrement]);

  const startIncrement = useCallback(() => {
    handleIncrement();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        handleIncrement();
      }, 100);
    }, 500);
  }, [handleIncrement]);

  const stopChange = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const canDecrement = value > minimumValue;
  const canIncrement = value < maximumValue;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.stepperContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { borderColor: color },
            !canDecrement && styles.buttonDisabled,
          ]}
          onPressIn={startDecrement}
          onPressOut={stopChange}
          disabled={!canDecrement}
        >
          <Text style={[styles.buttonText, { color: canDecrement ? color : '#64748b' }]}>−</Text>
        </TouchableOpacity>
        
        <View style={styles.valueContainer}>
          <Text style={[styles.value, { color }]}>{value}</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.button,
            { borderColor: color },
            !canIncrement && styles.buttonDisabled,
          ]}
          onPressIn={startIncrement}
          onPressOut={stopChange}
          disabled={!canIncrement}
        >
          <Text style={[styles.buttonText, { color: canIncrement ? color : '#64748b' }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    borderColor: '#334155',
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 20,
    fontFamily: 'Montserrat-SemiBold',
    lineHeight: 24,
  },
  valueContainer: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
  },
});
