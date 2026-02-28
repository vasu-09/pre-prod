// screens/ContactPickerScreen.js
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ContactPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(data);
    })();
  }, []);

  const toggleSelect = contact =>
    setSelected(curr =>
      curr.some(c => c.id === contact.id)
        ? curr.filter(c => c.id !== contact.id)
        : [...curr, contact]
    );

  const handleSend = () => {
    router.replace({
      pathname: '/screens/ChatDetailScreen',
      params: { contacts: JSON.stringify(selected) },
    });
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const isSel = selected.some(c => c.id === item.id);
    return (
      <TouchableOpacity onPress={() => toggleSelect(item)} style={styles.item}>
        {item.imageAvailable ? (
          <Image source={{ uri: item.image.uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Icon name="person" size={24} color="#888" />
          </View>
        )}
        <Text style={styles.name}>{item.name}</Text>
        {isSel && <Icon name="check-circle" size={24} color="#1f6ea7" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ◀️ Conditional header */}
      {isSearching ? (
        <View style={[styles.searchHeader, { paddingTop: insets.top }]}>
    <TouchableOpacity
      onPress={() => setIsSearching(false)}
      style={styles.searchBackBtn}
    >
      <Icon name="arrow-back" size={24} color="#1f6ea7" />
    </TouchableOpacity>
    <TextInput
      style={styles.searchHeaderInput}
      placeholder="Search contacts"
      placeholderTextColor="#999"
      value={searchQuery}
      onChangeText={setSearchQuery}
      autoFocus
      underlineColorAndroid="transparent"
    />
  </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top }]}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
      <Icon name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>

    {/* Title + subtitle stacked on the left */}
    <View style={styles.titleContainer}>
      <Text style={styles.title}>contacts to send</Text>
      <Text style={styles.subtitle}>{selected.length} selected</Text>
    </View>

    <TouchableOpacity onPress={() => { setIsSearching(true); setSearchQuery(''); }} style={styles.searchBtn}>
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
  </View>

        
      )}

      {/* Selected strip (unchanged) */}
      {selected.length > 0 && (
        <View style={styles.selectedWrapper}>
          <Text style={styles.sectionTitle}>Selected contacts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedList}
            contentContainerStyle={{ paddingHorizontal: 8 }}
          >
            {selected.map(c => (
              <View key={c.id} style={styles.selectedItem}>
                {c.imageAvailable ? (
                  <Image source={{ uri: c.image.uri }} style={styles.selectedAvatar} />
                ) : (
                  <View style={[styles.selectedAvatar, styles.placeholder]}>
                    <Icon name="person" size={20} color="#888" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => toggleSelect(c)}
                >
                  <Icon name="close" size={14} color="#666" />
                </TouchableOpacity>
                <Text style={styles.selectedName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* All contacts */}
      <Text style={styles.sectionTitle}>All contacts</Text>
      <FlatList
        data={filteredContacts}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />

      {/* Floating Send button */}
      {selected.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={handleSend}
        >
          <Icon name="send" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef5fa' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 8,
    height: 56,
    // remove fixed height so it can grow with two lines
  },

  backBtn: { padding: 8 },
  sendBtn: { padding: 8 },

  titleContainer: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 8,
  },

  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  // NORMAL header
  
  searchBtn: { padding: 8 },

  // SEARCH header replaces the normal header
 selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    marginTop: 8,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    marginTop: 12,
    marginBottom: 4,
  },

  selectedWrapper: {
    backgroundColor: '#f5f9ff',
    paddingVertical: 8,
  },
  selectedList: { height: 80 },
  selectedItem: {
    width: 60,
    alignItems: 'center',
    marginRight: 12,
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
    elevation: 2,
  },
  selectedName: {
    fontSize: 12,
    textAlign: 'center',
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  placeholder: {
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 16 },

  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    borderRadius: 28,
    padding: 16,
    elevation: 4,
  },

 


searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    height: 56,              // standard appbar height
  },

  // smaller hit area for the back arrow pill
  searchBackBtn: {
    padding: 8,
  },

  // full‑width, flat input
  searchHeaderInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 18,
    color: '#333',
    paddingVertical: 8,
  },
});