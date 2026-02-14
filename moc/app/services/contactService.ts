import type { Contact, PhoneNumber } from 'expo-contacts';

import apiClient from './apiClient';
import { normalizeIndianPhoneNumber } from './phoneNumber';

export interface ContactMatch {
  userId: number;
  phone: string;
}

export interface ContactDetails {
  name: string;
  imageUri?: string | null;
}

export const normalizePhoneNumber = (value: string): string | null =>
  normalizeIndianPhoneNumber(value);

const collectPhoneNumbers = (contacts: Contact[]): string[] => {
  const numbers = new Set<string>();

  contacts.forEach(contact => {
    (contact.phoneNumbers ?? []).forEach((phone: PhoneNumber) => {
      const rawNumber = phone?.number ?? '';
      if (!rawNumber) {
        return;
      }

      const normalized = normalizePhoneNumber(rawNumber);
      const rawDigits = rawNumber.replace(/\D/g, '');

      if (normalized) {
        numbers.add(normalized);

        const normalizedDigits = normalized.replace(/\D/g, '');
        if (normalizedDigits.length) {
          numbers.add(normalizedDigits);
        }

        if (normalizedDigits.length === 12 && normalizedDigits.startsWith('91')) {
          numbers.add(normalizedDigits.slice(2));
        }
      }

      if (rawDigits.length) {
        numbers.add(rawDigits);
      }
    });
  });

  return Array.from(numbers);
};

export const buildContactIndex = (contacts: Contact[]): Map<string, ContactDetails> => {
  const index = new Map<string, ContactDetails>();

  contacts.forEach((contact) => {
    (contact.phoneNumbers ?? []).forEach((phone: PhoneNumber) => {
      const normalized = phone?.number ? normalizePhoneNumber(phone.number) : null;
      if (!normalized || index.has(normalized)) {
        return;
      }

      index.set(normalized, {
        name: contact?.name?.trim() || normalized,
        imageUri: contact?.imageAvailable ? contact?.image?.uri ?? null : null,
      });
    });
  });

  return index;
};


export const syncContacts = async (contacts: Contact[]): Promise<ContactMatch[]> => {
  const phones = collectPhoneNumbers(contacts);

  if (phones.length === 0) {
    return [];
  }

  const { data } = await apiClient.post<ContactMatch[]>('/contacts/sync', { phones });

  return Array.isArray(data) ? data : [];
};