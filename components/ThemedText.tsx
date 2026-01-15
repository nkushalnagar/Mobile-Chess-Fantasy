import { Text as RNText, TextProps, StyleSheet } from 'react-native';

export function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  return (
    <RNText
      {...otherProps}
      style={[styles.defaultText, style]}
    />
  );
}

const styles = StyleSheet.create({
  defaultText: {
    fontFamily: 'Montserrat-Regular',
  },
});
