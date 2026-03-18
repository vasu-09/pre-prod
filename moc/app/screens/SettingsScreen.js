import { useRouter } from 'expo-router';
import {
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BAR_HEIGHT = 56;

export default function SettingsScreen() {
  const router = useRouter();

  const settings = [
    {
      title: 'Account',
      icon: 'person',
      route: '/screens/AccountSettings',
    },
    {
      title: 'Privacy & Security',
      icon: 'lock',
      route: '/screens/PrivacySecurityScreen',
    },
    {
      title: 'Notifications',
      icon: 'notifications',
      route: '/screens/NotificationSettingsScreen',
    },
    {
      title: 'Subscription',
      icon: 'workspace-premium',
      route: '/screens/SubscriptionSettings',
    },
    {
      title: 'Support',
      icon: 'support-agent',
      route: '/screens/SupportSettings',
    },
  ];

  

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f6ea7" />
      <View style={styles.header}>
        <TouchableOpacity         onPress={() => {
                   if (router.canGoBack()) router.back();
                    else router.replace('/screens/MocScreen');
                  }}
                  style={styles.iconBtn}
                >
                  <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {settings.map(({ title, icon, route }) => (
        <TouchableOpacity
          key={title}
          style={styles.item}
          onPress={() => router.push(route)}
        >
          <View style={styles.itemLeft}>
            <Icon name={icon} size={22} color="#1f6ea7" style={{ marginRight: 12 }} />
            <Text style={styles.itemText}>{title}</Text>
          </View>
          <Icon name="keyboard-arrow-right" size={24} color="#888" />
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <Text style={styles.versionText}>MoC v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height:BAR_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconBtn: { padding: 8 },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
});
