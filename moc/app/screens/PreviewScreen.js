import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import { initializeDatabase, saveListSummaryToDb } from '../services/database';

export default function PreviewScreen() {
  const { listName, items, listType = 'Normal List' } = useLocalSearchParams();
  const parsedItems = JSON.parse(items || '[]');
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const isPremiumList = listType === 'Premium List';

  const formatQuantity = (quantity, unit) => {
    const trimmedQuantity = String(quantity ?? '').trim();
    const trimmedUnit = String(unit ?? '').trim();

    if (!trimmedQuantity && !trimmedUnit) {
      return null;
    }

    return `${trimmedQuantity}${trimmedUnit}`.trim();
  };

  const formatPrice = (price) => {
    const trimmedPrice = String(price ?? '').trim();

    if (!trimmedPrice) {
      return null;
    }

    return trimmedPrice.startsWith('₹') ? trimmedPrice : `₹${trimmedPrice}`;
  };

  const buildPremiumItemsPayload = () => parsedItems
    .filter((item) => item?.name && String(item.name).trim())
    .map((item) => {
      const subQuantitiesArray = Array.isArray(item.subQuantities) ? item.subQuantities : [];
      const subQuantities = subQuantitiesArray
        .map((sub) => ({
          quantity: formatQuantity(sub.quantity, sub.unit),
          priceText: formatPrice(sub.price),
        }))
        .filter((sub) => sub.quantity || sub.priceText);

      return {
        itemName: item.name,
        quantity: formatQuantity(item.quantity, item.unit),
        priceText: formatPrice(item.price),
        subQuantities,
      };
    });

  const buildChecklistItemsPayload = () => parsedItems
    .filter((item) => item?.name && String(item.name).trim())
    .map((item) => ({
      itemName: item.name,
    }));

  const buildItemsForStorage = () => {
    if (isPremiumList) {
      return buildPremiumItemsPayload().map(item => ({
        itemName: item.itemName,
        quantity: item.quantity ?? null,
        priceText: item.priceText ?? null,
        subQuantities: Array.isArray(item.subQuantities) ? item.subQuantities : [],
      }));
    }

    return buildChecklistItemsPayload().map(item => ({
      itemName: item.itemName,
      quantity: null,
      priceText: null,
      subQuantities: [],
    }));
  };
  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (!parsedItems.length) {
      Alert.alert('Nothing to save', 'Add at least one item before saving the list.');
      return;
    }

    setIsSaving(true);

    try {
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;

      if (!userIdValue) {
        Alert.alert('Unable to create list', 'Please sign in again to continue.');
        return;
      }

      const endpoint = isPremiumList ? '/api/lists' : '/api/lists/checklist';
      const itemsPayload = isPremiumList ? buildPremiumItemsPayload() : buildChecklistItemsPayload();

      if (!itemsPayload.length) {
        Alert.alert('Nothing to save', 'Add at least one item before saving the list.');
        return;
      }

      const payload = {
        createdByUserId: userIdValue,
        title: listName || 'Untitled List',
        items: itemsPayload,
      };

      const { data } = await apiClient.post(endpoint, payload);
      const createdListId = data?.id ?? data?.listId ?? null;
      const resolvedTitle = data?.title ?? listName;

       if (createdListId != null) {
        try {
          await initializeDatabase();
          await saveListSummaryToDb({
            id: String(createdListId),
            title: resolvedTitle || 'Untitled List',
            listType: isPremiumList ? 'PREMIUM' : 'BASIC',
            pinned: Boolean(data?.pinned ?? data?.isPinned ?? false),
            createdAt: data?.createdAt ?? null,
            updatedAt: data?.updatedAt ?? null,
            createdByUserId:
              data?.createdByUserId != null
                ? String(data.createdByUserId)
                : userIdValue != null
                  ? String(userIdValue)
                  : null,
            items: buildItemsForStorage(),
          });
        } catch (dbError) {
          console.error('Failed to cache created list locally', dbError);
        }
      }


      router.push({
        pathname: '/screens/LinkListScreen',
        params: {
          listName: resolvedTitle,
          items: JSON.stringify(parsedItems),
          listId: createdListId != null ? String(createdListId) : undefined,
          listType,
        },
      });
    } catch (error) {
      console.error('Failed to save list', error);
      Alert.alert('Unable to save list', 'Something went wrong while saving your list. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/screens/MocScreen');
        }} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
      </View>

      {/* List title and image */}
      <View style={styles.topInfo}>
        <View style={styles.imagePlaceholder}>
          <Icon name="image" size={32} color="#ccc" />
        </View>
        <Text style={styles.listTitle}>{listName}</Text>
      </View>

      {/* Items and sub-quantities */}
      <FlatList
        data={parsedItems}
        keyExtractor={(_, idx) => idx.toString()}
        contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
          const subQuantities = Array.isArray(item.subQuantities) ? item.subQuantities : [];
          const hasDetails =
            !!item.quantity ||
            !!item.unit ||
            !!item.price ||
            subQuantities.length > 0;
          return (
            <View style={styles.itemBlock}>
              <Text style={styles.itemName}>{item.name}</Text>
              {hasDetails && (
                <>
                  {(item.quantity || item.unit || item.price) && (
                    <View style={styles.row}>
                      <Text style={styles.itemQty}>{`${item.quantity || ''}${item.unit || ''}`}</Text>
                      {item.price ? (
                        <Text style={styles.itemPrice}>{`₹${item.price}`}</Text>
                      ) : null}
                    </View>
                  )}
                  {item.subQuantities.map((sub, i) => (
                    <View style={styles.subRow} key={i}>
                      <Text style={styles.subQty}>{`${sub.quantity || ''}${sub.unit || ''}`}</Text>
                      {sub.price ? (
                        <Text style={styles.subPrice}>{`₹${sub.price}`}</Text>
                      ) : null}
                    </View>
                  ))}
                </>
              )}
            </View>
          );
        }}
      />

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },

  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  imagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#333' },

  listContainer: { padding: 12 },
  itemBlock: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#000' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemQty: { fontSize: 14, color: '#555' },
  itemPrice: { fontSize: 14, color: '#555' },

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: 16,
  },
  subQty: { fontSize: 14, color: '#777' },
  subPrice: { fontSize: 14, color: '#777' },

  saveBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
  },
    saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});


