import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const WebMapView = forwardRef(function WebMapView({ style, children }, ref) {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
  }));

  return (
    <View style={[StyleSheet.absoluteFill, style, styles.fallback]}>
      <Text style={styles.text}>
        Map preview isn`t available on the web. Please use a mobile device to
        pick a location.
      </Text>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 16,
  },
  text: {
    color: '#333',
    textAlign: 'center',
  },
});

export default WebMapView;