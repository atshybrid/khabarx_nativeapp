import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';

export default function LottieLoader({ size = 72 }: { size?: number }) {
  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/lotti/hrci_loader_svg.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
