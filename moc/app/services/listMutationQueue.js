import AsyncStorage from '@react-native-async-storage/async-storage';

import apiClient from './apiClient';
import { getStoredSession } from './authStorage';
import { getListSummaryFromDb, saveListSummaryToDb } from './database';

const STORAGE_KEY = 'moc.listMutationQueue.v1';

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readQueue = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseJsonSafely(raw, []);
};

const writeQueue = async (queue) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const isProbablyOfflineError = (error) => !error?.response;

const buildMutationId = () =>
  `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseSubQuantities = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeServerItem = (data, fallbackName = '') => ({
  id: data?.id != null ? String(data.id) : `server-${Date.now()}`,
  itemName: data?.itemName ?? fallbackName,
  quantity: data?.quantity ?? null,
  priceText: data?.priceText ?? null,
  subQuantities: parseSubQuantities(data?.subQuantitiesJson),
  createdAt: data?.createdAt ?? new Date().toISOString(),
  updatedAt: data?.updatedAt ?? new Date().toISOString(),
});

const replaceLocalItemInDb = async (listId, localItemId, serverItem) => {
  const summary = await getListSummaryFromDb(String(listId));
  if (!summary) return;

  const exists = summary.items.some(
    (item) => String(item?.id) === String(localItemId),
  );

  const nextItems = exists
    ? summary.items.map((item) =>
        String(item?.id) === String(localItemId) ? serverItem : item,
      )
    : [...summary.items, serverItem];

  await saveListSummaryToDb({
    ...summary,
    id: String(listId),
    items: nextItems,
  });
};

const remapQueuedItemIds = (queue, startIndex, oldId, newId) => {
  for (let i = startIndex + 1; i < queue.length; i += 1) {
    const entry = queue[i];
    if (!entry?.payload) continue;

    if (String(entry.payload.itemId ?? '') === String(oldId)) {
      entry.payload.itemId = String(newId);
    }

    if (String(entry.payload.localItemId ?? '') === String(oldId)) {
      entry.payload.localItemId = String(newId);
    }
  }
};

export const enqueueListMutation = async (mutation) => {
  let queue = await readQueue();

  const entry = {
    id: mutation?.id ?? buildMutationId(),
    createdAt: new Date().toISOString(),
    ...mutation,
  };

  if (entry.type === 'pin-list') {
    queue = queue.filter(
      (item) =>
        !(
          item?.type === 'pin-list' &&
          String(item?.payload?.listId) === String(entry?.payload?.listId)
        ),
    );
    queue.push(entry);
    await writeQueue(queue);
    return entry;
  }

  if (entry.type === 'delete-list') {
    queue = queue.filter(
      (item) => String(item?.payload?.listId) !== String(entry?.payload?.listId),
    );
    queue.push(entry);
    await writeQueue(queue);
    return entry;
  }

  if (entry.type === 'update-item-name') {
    const addIndex = queue.findIndex(
      (item) =>
        item?.type === 'add-item' &&
        String(item?.payload?.listId) === String(entry?.payload?.listId) &&
        String(item?.payload?.localItemId) === String(entry?.payload?.itemId),
    );

    if (addIndex >= 0) {
      queue[addIndex] = {
        ...queue[addIndex],
        payload: {
          ...queue[addIndex].payload,
          itemName: entry?.payload?.itemName,
        },
      };
      await writeQueue(queue);
      return queue[addIndex];
    }
  }

  if (entry.type === 'delete-item') {
    const addIndex = queue.findIndex(
      (item) =>
        item?.type === 'add-item' &&
        String(item?.payload?.listId) === String(entry?.payload?.listId) &&
        String(item?.payload?.localItemId) === String(entry?.payload?.itemId),
    );

    if (addIndex >= 0) {
      queue = queue.filter((item, index) => {
        if (index === addIndex) return false;

        const sameList =
          String(item?.payload?.listId ?? '') ===
          String(entry?.payload?.listId ?? '');
        const sameItem =
          String(item?.payload?.itemId ?? '') ===
            String(entry?.payload?.itemId ?? '') ||
          String(item?.payload?.localItemId ?? '') ===
            String(entry?.payload?.itemId ?? '');

        return !(sameList && sameItem);
      });

      await writeQueue(queue);
      return entry;
    }
  }

  queue.push(entry);
  await writeQueue(queue);
  return entry;
};

const applyMutation = async (mutation, userId) => {
  const headers = { 'X-User-Id': String(userId) };
  const payload = mutation?.payload ?? {};

  switch (mutation?.type) {
    case 'pin-list': {
      await apiClient.put(
        `/api/lists/${encodeURIComponent(String(payload.listId))}/pin`,
        { pinned: Boolean(payload.pinned) },
        { headers },
      );
      return null;
    }

    case 'delete-list': {
      await apiClient.delete(
        `/api/lists/${encodeURIComponent(String(payload.listId))}`,
        { headers },
      );
      return null;
    }

    case 'add-item': {
      const { data } = await apiClient.post(
        `/api/lists/${encodeURIComponent(String(payload.listId))}/checklist/items`,
        { itemName: String(payload.itemName ?? '').trim() },
        { headers },
      );

      const serverItem = normalizeServerItem(data, payload.itemName);
      await replaceLocalItemInDb(payload.listId, payload.localItemId, serverItem);

      return {
        oldId: String(payload.localItemId),
        newId: String(serverItem.id),
      };
    }

    case 'update-item-name': {
      await apiClient.put(
        `/api/lists/${encodeURIComponent(String(payload.listId))}/checklist/items/${encodeURIComponent(String(payload.itemId))}`,
        { itemName: String(payload.itemName ?? '').trim() },
        { headers },
      );
      return null;
    }

    case 'delete-item': {
      await apiClient.delete(
        `/api/lists/${encodeURIComponent(String(payload.listId))}/checklist/items/${encodeURIComponent(String(payload.itemId))}`,
        { headers },
      );
      return null;
    }

    case 'remove-recipient': {
      await apiClient.delete(
        `/api/lists/${encodeURIComponent(String(payload.listId))}/recipients-by-phone`,
        {
          headers,
          data: String(payload.phone ?? '').trim(),
        },
      );
      return null;
    }

    default:
      return null;
  }
};

export const flushListMutationQueue = async () => {
  const queue = await readQueue();
  if (!queue.length) {
    return { processed: 0, remaining: 0 };
  }

  const session = await getStoredSession();
  const userId = session?.userId ? Number(session.userId) : null;

  if (!userId) {
    return { processed: 0, remaining: queue.length };
  }

  for (let index = 0; index < queue.length; index += 1) {
    const mutation = queue[index];

    try {
      const remap = await applyMutation(mutation, userId);

      if (remap?.oldId && remap?.newId) {
        remapQueuedItemIds(queue, index, remap.oldId, remap.newId);
      }
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        const remaining = queue.slice(index);
        await writeQueue(remaining);
        return {
          processed: index,
          remaining: remaining.length,
        };
      }

      console.warn('Skipping unrecoverable queued mutation', mutation, error);
    }
  }

  await writeQueue([]);
  return {
    processed: queue.length,
    remaining: 0,
  };
};