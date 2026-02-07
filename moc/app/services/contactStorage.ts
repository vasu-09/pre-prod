import type { ExistingContact } from 'expo-contacts';

import { buildContactIndex, normalizePhoneNumber, syncContacts, type ContactMatch } from './contactService';
import {
  getContactsFromDb,
  replaceContactsInDb,
  searchContactsInDb as searchContactsInNativeDb,
  type StoredContactInput,
} from './database.native';

type PhoneEntry = { label?: string | null; number: string };

type MatchLookup = Map<string, ContactMatch>;

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
  contacts: ExistingContact[],
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
      imageUri: contact.imageAvailable ? contact?.image?.uri ?? null : indexed?.imageUri ?? null,
      matchPhone: match?.phone ?? null,
      matchUserId: match?.userId ?? null,
      updatedAt: new Date().toISOString(),
    };
  });

  await replaceContactsInDb(rows);
};

export const readStoredContacts = async (): Promise<StoredContactInput[]> => getContactsFromDb();

// Save the provided contacts into SQLite while keeping match metadata up to date.
// This is reused anywhere the device contacts are synced so that the local DB
// remains our source of truth for contact lists.
export const saveContactsToDb = async (
  contacts: ExistingContact[],
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

export const searchContactsInDb = async (query: string): Promise<StoredContactInput[]> => {
  if (!query?.trim()) {
    return getContactsFromDb();
  }

  return searchContactsInNativeDb(query.trim());
};

export const syncAndPersistContacts = async (
  contacts: ExistingContact[],
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