import * as Contacts from 'expo-contacts';

import { buildContactIndex, normalizePhoneNumber, syncContacts, type ContactMatch } from './contactService';
import {
  getContactsFromDb,
  getMetaValueFromDb,
  replaceContactsInDb,
  searchContactsInDb as searchContactsInNativeDb,
  setMetaValueInDb,
  type StoredContactInput,
} from './database.native';

type PhoneEntry = { label?: string | null; number: string };

type MatchLookup = Map<string, ContactMatch>;

export const CONTACTS_LAST_SYNCED_AT_META_KEY = 'contacts_last_synced_at';

const buildMatchLookup = (matches: ContactMatch[]): MatchLookup => {
  const lookup: MatchLookup = new Map();

  matches.forEach((match) => {
    const normalized = normalizePhoneNumber(match.phone);

    if (normalized) {
      lookup.set(normalized, match);

      const digits = normalized.replace(/\D/g, '');
      if (digits) {
        lookup.set(digits, match);
        if (digits.startsWith('91') && digits.length === 12) {
          lookup.set(digits.slice(2), match);
        }
      }
    }

    const digitsOnly = match.phone.replace(/\D/g, '');
    if (digitsOnly && !lookup.has(digitsOnly)) {
      lookup.set(digitsOnly, match);
    }
  });

  return lookup;
};

const findMatchForPhones = (phones: PhoneEntry[], lookup: MatchLookup): ContactMatch | null => {
  for (const phone of phones) {
    const normalized = normalizePhoneNumber(phone.number);
    const digits = phone.number.replace(/\D/g, '');

    if (normalized && lookup.has(normalized)) {
      return lookup.get(normalized) ?? null;
    }

    if (digits && lookup.has(digits)) {
      return lookup.get(digits) ?? null;
    }
  }

  return null;
};

export const persistContactsToDb = async (
  contacts: Contacts.Contact[],
  matches: ContactMatch[],
): Promise<void> => {
  const lookup = buildMatchLookup(matches ?? []);
  const contactIndex = buildContactIndex(contacts);

  const rows: StoredContactInput[] = contacts.map((contact) => {
    const phoneNumbers: PhoneEntry[] = (contact.phoneNumbers ?? [])
      .map((entry) => ({ label: entry?.label ?? null, number: entry?.number ?? '' }))
      .filter((entry) => Boolean(entry.number));

    const match = findMatchForPhones(phoneNumbers, lookup);
    const contactId = contact.id ? String(contact.id) : null;
    const indexed = match?.phone ? contactIndex.get(normalizePhoneNumber(match.phone) ?? match.phone) : null;

    return {
      id: contactId,
      name: contact.name ?? indexed?.name ?? 'Unknown contact',
      phoneNumbers,
      imageUri:
        contact.imageAvailable
          ? contact?.image?.uri ?? null
          : match?.avatarUrl ?? indexed?.imageUri ?? null,
      matchPhone: match?.phone ?? null,
      matchUserId: match?.userId ?? null,
      updatedAt: new Date().toISOString(),
    };
  });

  await replaceContactsInDb(rows);
};

export const readStoredContacts = async (): Promise<StoredContactInput[]> => getContactsFromDb();

export const saveContactsToDb = async (
  contacts: Contacts.Contact[],
  matches?: ContactMatch[],
): Promise<ContactMatch[]> => {
  if (!contacts?.length) {
    return [];
  }

  const resolvedMatches = matches ?? (await syncContacts(contacts));

  try {
    await persistContactsToDb(contacts, resolvedMatches);
  } catch (error) {
    console.warn('Unable to cache contacts locally', error);
  }

  return resolvedMatches;
};

export const getAllContactsFromDb = async (): Promise<StoredContactInput[]> => getContactsFromDb();

export const getMatchedContactsFromDb = async (): Promise<StoredContactInput[]> => {
  const contacts = await getContactsFromDb();
  const uniqueByUserId = new Map<string, StoredContactInput>();

  contacts.forEach((contact) => {
    const userId = contact?.matchUserId != null ? String(contact.matchUserId) : '';
    if (!userId || uniqueByUserId.has(userId)) {
      return;
    }

    uniqueByUserId.set(userId, contact);
  });

  return Array.from(uniqueByUserId.values());
};

export const getInviteContactsFromDb = async (): Promise<StoredContactInput[]> => {
  const contacts = await getContactsFromDb();
  return contacts.filter((contact) => (contact.phoneNumbers ?? []).length > 0 && contact.matchUserId == null);
};

export const searchContactsInDb = async (query: string): Promise<StoredContactInput[]> => {
  if (!query?.trim()) {
    return getContactsFromDb();
  }

  return searchContactsInNativeDb(query.trim());
};

export const searchMatchedContactsFromDb = async (query: string): Promise<StoredContactInput[]> => {
  const results = await searchContactsInDb(query);
  const uniqueByUserId = new Map<string, StoredContactInput>();

  results.forEach((contact) => {
    const userId = contact?.matchUserId != null ? String(contact.matchUserId) : '';
    if (!userId || uniqueByUserId.has(userId)) {
      return;
    }

    uniqueByUserId.set(userId, contact);
  });

  return Array.from(uniqueByUserId.values());
};

export const syncAndPersistContacts = async (
  contacts: Contacts.Contact[],
): Promise<ContactMatch[]> => {
  if (!contacts?.length) {
    return [];
  }

  const matches = await syncContacts(contacts);

  try {
    await persistContactsToDb(contacts, matches);
  } catch (error) {
    console.warn('Unable to cache contacts locally', error);
  }

  return matches;
};

export const setContactsLastSyncedAt = async (isoString: string): Promise<void> => {
  await setMetaValueInDb(CONTACTS_LAST_SYNCED_AT_META_KEY, isoString);
};

export const getContactsLastSyncedAt = async (): Promise<string | null> =>
  getMetaValueFromDb(CONTACTS_LAST_SYNCED_AT_META_KEY);
