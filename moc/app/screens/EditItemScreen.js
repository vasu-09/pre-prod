import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import {
  getListSummaryFromDb,
  initializeDatabase,
  saveListSummaryToDb,
} from '../services/database';

const nextUnit = unit => {
  const units = ['kg', 'gm', 'ps'];
  const idx = units.indexOf(unit);
  return units[(idx + 1) % units.length];
};

const parseQuantity = q => {
  const match = q?.match(/(\d+)([a-zA-Z]+)/);
  return match ? { quantity: match[1], unit: match[2] } : { quantity: q || '', unit: 'kg' };
};

const parseSubQuantitiesJson = value => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse premium item sub quantities', error);
    return [];
  }
};

export default function EditItemScreen() {
  const { item, listId: rawListId } = useLocalSearchParams();
  const listId = Array.isArray(rawListId) ? rawListId[0] : rawListId ?? null;
  const parsed = item ? JSON.parse(item) : {};
  const main = parseQuantity(parsed.quantity || '');
  const [name, setName] = useState(parsed.itemName || '');
  const [quantity, setQuantity] = useState(main.quantity);
  const [unit, setUnit] = useState(main.unit);
  const [price, setPrice] = useState(parsed.priceText ? parsed.priceText.replace(/[^\d]/g, '') : '');
  const [subQuantities, setSubQuantities] = useState(
    (parsed.subQuantities || []).map(s => {
      const q = parseQuantity(s.quantity || '');
      return { quantity: q.quantity, unit: q.unit, price: s.priceText?.replace(/[^\d]/g, '') || '' };
    })
  );
   const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();
  const isEditingExisting = parsed?.id != null;
  const screenTitle = isEditingExisting ? 'Updating item' : 'Add item';

  const addSubQuantity = () => {
    setSubQuantities(prev => [...prev, { quantity: '', unit: 'kg', price: '' }]);
  };

  const removeSubQuantity = idx => {
    setSubQuantities(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleUnit = () => setUnit(nextUnit(unit));
  const toggleSubUnit = idx => {
    setSubQuantities(prev => {
      const arr = [...prev];
      arr[idx].unit = nextUnit(arr[idx].unit);
      return arr;
    });
  };

  const persistItemToDatabase = useCallback(
    async (dbItem) => {
      if (!listId) {
        return;
      }

      try {
        await initializeDatabase();
        const summary = await getListSummaryFromDb(String(listId));
        if (!summary) {
          return;
        }

        const normalizedItem = {
          ...dbItem,
          id: dbItem?.id != null ? String(dbItem.id) : String(Date.now()),
        };

        const existingItems = Array.isArray(summary.items) ? summary.items : [];
        let nextItems;

        if (isEditingExisting && normalizedItem.id) {
          nextItems = existingItems.map(item =>
            item?.id === normalizedItem.id ? { ...item, ...normalizedItem } : item,
          );
        } else {
          const deduped = normalizedItem.id
            ? existingItems.filter(item => item?.id !== normalizedItem.id)
            : existingItems;
          nextItems = [...deduped, normalizedItem];
        }

        await saveListSummaryToDb({
          ...summary,
          id: String(listId),
          items: nextItems,
        });
      } catch (dbError) {
        console.error('Failed to update local list cache', dbError);
      }
    },
    [isEditingExisting, listId],
  );


    const buildQuantityText = (value, valueUnit) => {
    const qty = value?.trim();
    if (!qty) {
      return null;
    }
    return `${qty}${valueUnit}`;
  };

  const buildPriceText = value => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Update item', 'Please enter a name for the item.');
      return;
    }

    if (!listId) {
      Alert.alert('Save item', 'Missing list identifier.');
      return;
    }

    try {
      setIsSaving(true);
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;
      const headers = userIdValue ? { 'X-User-Id': String(userIdValue) } : undefined;

      const normalizedSubQuantities = subQuantities
        .map(sub => {
          const quantityText = buildQuantityText(sub.quantity, sub.unit);
          const priceText = buildPriceText(sub.price);
          if (!quantityText && !priceText) {
            return null;
          }
          return {
            quantity: quantityText,
            priceText,
          };
        })
        .filter(Boolean);

      const payload = {
        itemName: trimmedName,
        quantity: buildQuantityText(quantity, unit),
        priceText: buildPriceText(price),
        subQuantities: normalizedSubQuantities,
      };

      const response = isEditingExisting
        ? await apiClient.put(
            `/api/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(parsed.id)}`,
            payload,
            { headers },
          )
        : await apiClient.post(
            `/api/lists/${encodeURIComponent(listId)}/items`,
            payload,
            { headers },
          );

      const responseData = response?.data ?? null;
      const resolvedId = responseData?.id ?? parsed?.id ?? Date.now();
      const apiSubQuantities = Array.isArray(responseData?.subQuantities)
        ? responseData.subQuantities
        : parseSubQuantitiesJson(responseData?.subQuantitiesJson);
      const resolvedSubQuantities = (apiSubQuantities && apiSubQuantities.length)
        ? apiSubQuantities
        : normalizedSubQuantities;

      await persistItemToDatabase({
        id: String(resolvedId),
        itemName: responseData?.itemName ?? trimmedName,
        quantity: responseData?.quantity ?? payload.quantity ?? null,
        priceText: responseData?.priceText ?? payload.priceText ?? null,
        subQuantities: resolvedSubQuantities ?? [],
        createdAt: responseData?.createdAt ?? parsed?.createdAt ?? null,
        updatedAt: responseData?.updatedAt ?? null,
      });

      router.back();
    } catch (error) {
      console.error('Failed to update item', error);
      Alert.alert('Save failed', 'Unable to save the item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
         <Text style={styles.headerTitle}>{screenTitle}</Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity onPress={addSubQuantity} style={styles.plusBtn}>
          <Icon name="add" size={20} color="#1f6ea7" />
        </TouchableOpacity>
         <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Item name"
          placeholderTextColor="#888"
          style={[styles.inputLine, styles.nameInput]}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          placeholder="quantity"
          placeholderTextColor="#888"
          keyboardType="numeric"
          style={[styles.inputLineText, styles.smallInputText]}
        />
        <TouchableOpacity onPress={toggleUnit} style={styles.unitBtn}>
          <Text style={styles.unitText}>{unit}</Text>
          <Icon name="arrow-drop-down" size={20} color="#888" />
        </TouchableOpacity>
        <Icon name="currency-rupee" size={16} color="#000" style={styles.priceIcon} />
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="price"
          placeholderTextColor="#888"
          keyboardType="numeric"
          style={[styles.inputLineText, styles.smallInputText]}
        />
      </View>

      {subQuantities.map((sub, idx) => (
        <View key={idx} style={[styles.row, styles.subRow]}>
          <TouchableOpacity onPress={() => removeSubQuantity(idx)} style={styles.plusBtn}>
            <Icon name="remove-circle-outline" size={20} color="#d00" />
          </TouchableOpacity>
          <TextInput
            style={[styles.inputLine, styles.smallInput]}
            placeholder="quantity"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={sub.quantity}
            onChangeText={t => {
              setSubQuantities(prev => {
                const arr = [...prev];
                arr[idx].quantity = t;
                return arr;
              });
            }}
          />
          <TouchableOpacity onPress={() => toggleSubUnit(idx)} style={styles.unitBtn}>
            <Text style={styles.unitText}>{sub.unit}</Text>
            <Icon name="arrow-drop-down" size={20} color="#888" />
          </TouchableOpacity>
          <Icon name="currency-rupee" size={16} color="#000" style={styles.priceIcon} />
          <TextInput
            style={[styles.inputLine, styles.smallInput]}
            placeholder="price"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={sub.price}
            onChangeText={t => {
              setSubQuantities(prev => {
                const arr = [...prev];
                arr[idx].price = t;
                return arr;
              });
            }}
          />
        </View>
      ))}

       <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save</Text>
        )}
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
    paddingHorizontal: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  subRow: { paddingLeft: 36, backgroundColor: '#fafafa' },
  plusBtn: { width: 24, alignItems: 'center' },
  inputLine: {
    fontSize: 14,
    padding: 0,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  nameInput: { flex: 2, marginRight: 12 },
  smallInput: { flex: 1, marginRight: 8, textAlign: 'center' },
  unitBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  unitText: { fontSize: 14, color: '#000', marginRight: 4 },
  priceIcon: { marginRight: 4 },
  saveBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 24,
    elevation: 4,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});