// NewListScreen.js

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';


const INITIAL_ITEMS = [
  {
    id: '0',
    placeholder: 'Item 1 name',
    name: '',
    quantity: '',
    unit: 'kg',
    price: '',
    subQuantities: [],
  },
];

const nextUnit = unit => {
  const units = ['kg', 'gm', 'ps'];
  const index = units.indexOf(unit);
  return units[(index + 1) % units.length];
};

export default function NewListScreen() {
  const [listName, setListName] = useState('');
  const [items, setItems] = useState(INITIAL_ITEMS);
   const [tasks, setTasks] = useState([{ id: '0', text: '' }]);
  const [listType, setListType] = useState('Normal List');
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const updateItemField = (idx, field, val) => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: val };

      if (idx === arr.length - 1 && val.trim() !== '') {
        arr.push({
          id: arr.length.toString(),
          placeholder: `Item ${arr.length + 1} name`,
          name: '',
          quantity: '',
          unit: 'kg',
          price: '',
          subQuantities: [],
        });
      }

      return arr;
    });
  };

  const toggleUnit = idx => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx].unit = nextUnit(arr[idx].unit);
      return arr;
    });
  };

  const addSubQuantity = idx => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx].subQuantities = [
        ...arr[idx].subQuantities,
        { quantity: '', unit: 'kg', price: '' },
      ];
      return arr;
    });
  };

  const removeSubQuantity = (idx, subIdx) => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx].subQuantities = arr[idx].subQuantities.filter((_, i) => i !== subIdx);
      return arr;
    });
  };

  const updateSubField = (idx, subIdx, field, val) => {
    setItems(prev => {
      const arr = [...prev];
      const sub = [...arr[idx].subQuantities];
      sub[subIdx] = { ...sub[subIdx], [field]: val };
      arr[idx].subQuantities = sub;
      return arr;
    });
  };

  const toggleSubUnit = (idx, subIdx) => {
    setItems(prev => {
      const arr = [...prev];
      const sub = [...arr[idx].subQuantities];
      sub[subIdx].unit = nextUnit(sub[subIdx].unit);
      arr[idx].subQuantities = sub;
      return arr;
    });
  };

    const updateTaskField = (idx, val) => {
    setTasks(prev => {
      const arr = [...prev];
      arr[idx].text = val;
      if (idx === arr.length - 1 && val.trim() !== '') {
        arr.push({ id: arr.length.toString(), text: '' });
      }
      return arr;
    });
  };

  const renderItem = ({ item, index }) => (
    <>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => addSubQuantity(index)} style={styles.plusBtn}>
          <Icon name="add" size={20} color="#1f6ea7" />
        </TouchableOpacity>

         <TextInput
          style={[styles.inputLine, styles.nameInput]}
          placeholder={item.placeholder}
          placeholderTextColor="#888"
          value={item.name}
          onChangeText={t => updateItemField(index, 'name', t)}
          />

         <TextInput
          style={[styles.inputLine, styles.smallInput]}
          placeholder="quantity"
          placeholderTextColor="#888"
          keyboardType="numeric"
          value={item.quantity}
          onChangeText={t => updateItemField(index, 'quantity', t)}
        />

        <TouchableOpacity onPress={() => toggleUnit(index)} style={styles.unitBtn}>
          <Text style={styles.unitText}>{item.unit}</Text>
          <Icon name="arrow-drop-down" size={20} color="#888" />
        </TouchableOpacity>

        <Icon name="currency-rupee" size={16} color="#000" style={styles.priceIcon} />
        <TextInput
          style={[styles.inputLine, styles.smallInput]}
          value={item.price}
          onChangeText={t => updateItemField(index, 'price', t)}
          placeholder="price"
          placeholderTextColor="#888"
          keyboardType="numeric"
        />
      </View>

      {item.subQuantities.map((sub, subIdx) => (
        <View style={[styles.row, styles.subRow]} key={subIdx}>
          <TouchableOpacity
            onPress={() => removeSubQuantity(index, subIdx)}
            style={styles.plusBtn}
          >
            <Icon name="remove-circle-outline" size={20} color="#d00" />
          </TouchableOpacity>

           <TextInput
            style={[styles.inputLine, styles.smallInput]}
            value={sub.quantity}
            onChangeText={t => updateSubField(index, subIdx, 'quantity', t)}
            placeholder="quantity"
            placeholderTextColor="#888"
            keyboardType="numeric"
          />

          <TouchableOpacity
            onPress={() => toggleSubUnit(index, subIdx)}
            style={styles.unitBtn}
          >
            <Text style={styles.unitText}>{sub.unit}</Text>
            <Icon name="arrow-drop-down" size={20} color="#888" />
          </TouchableOpacity>

          <Icon name="currency-rupee" size={16} color="#000" style={styles.priceIcon} />
           <TextInput
            style={[styles.inputLine, styles.smallInput]}
            value={sub.price}
            onChangeText={t => updateSubField(index, subIdx, 'price', t)}
            placeholder="price"
            placeholderTextColor="#888"
            keyboardType="numeric"
          />
        </View>
      ))}
    </>
  );

  const renderTask = ({ item, index }) => (
    <View style={styles.taskRow}>
      <Text style={styles.taskNumber}>{index + 1}.  </Text>
      <TextInput
        style={[styles.inputLine, styles.taskInput]}
        placeholder=" Add new task"
        placeholderTextColor="#888"
        value={item.text}
        onChangeText={t => updateTaskField(index, t)}
      />
    </View>
  );

  const handlePreview = () => {
     if (listType === 'Premium List') {
      const nonEmptyItems = items.filter(item => item.name.trim() !== '');
      router.push({
        pathname: '/screens/PreviewScreen',
        params: { listName, items: JSON.stringify(nonEmptyItems), listType  },
      });
    } else {
      const nonEmptyTasks = tasks
        .filter(t => t.text.trim() !== '')
        .map(t => ({ name: t.text, quantity: '', unit: '', price: '', subQuantities: [] }));
      router.push({
        pathname: '/screens/PreviewScreen',
        params: { listName, items: JSON.stringify(nonEmptyTasks), listType  },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ position: 'relative' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/screens/MocScreen');
          }} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New list</Text>
          <TouchableOpacity style={styles.typeBtn} onPress={() => setShowDropdown(prev => !prev)}>
            <Text style={styles.typeText}>{listType}</Text>
            <Icon name={showDropdown ? 'arrow-drop-up' : 'arrow-drop-down'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {showDropdown && (
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setListType('Premium List');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>Premium List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setListType('Normal List');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>Normal List</Text>
            </TouchableOpacity>
          </View>
        )}</View>

      <View style={styles.topInputContainer}>
        <TouchableOpacity style={styles.imagePlaceholder}>
          <Icon name="add-photo-alternate" size={24} color="#888" />
        </TouchableOpacity>
       <TextInput
          style={styles.listNameInput}
          placeholder="Name of the List"
          placeholderTextColor="#888"
          value={listName}
          onChangeText={setListName}
        />
      </View>
      <View style={styles.divider} />

      {listType === 'Premium List' ? (
        <FlatList
          data={items}
          keyExtractor={it => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={it => it.id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.previewBtn}
        onPress={handlePreview}
      >
        <Text style={styles.previewText}>Preview</Text>
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
    justifyContent: 'space-between',
  },
  backBtn: { padding: 8 },
 headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  typeText: { color: '#fff', fontSize: 16, marginRight: 4 },
  dropdown: {
    position: 'absolute',
    right: 30,
    top: 36,
    backgroundColor: '#fff',
    borderRadius: 4,
    elevation: 10,
    zIndex: 1,
  },
  dropdownOption: { paddingHorizontal: 12, paddingVertical: 8 },
  dropdownOptionText: { fontSize: 16, color: '#000' },

  topInputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12,  zIndex: 0 },
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
  listNameInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  divider: { height: 1, backgroundColor: '#ccc', marginHorizontal: 12 },

   taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  taskIcon: { marginRight: 12 },
  taskInput: { flex: 1 },

  listContainer: { paddingBottom: 100 },
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

  previewBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 24,
    elevation: 4,
  },
  previewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});