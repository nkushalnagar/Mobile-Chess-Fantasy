import { View, Text, StyleSheet } from 'react-native';

export default function SimpleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>✅ React Native is Working!</Text>
      <Text style={styles.subtext}>If you see this, the app is rendering.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#93c5fd',
    textAlign: 'center',
  },
});
