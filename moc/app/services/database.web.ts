// app/services/database.web.ts
// Stub DB for web / DevTools so we don't pull in expo-sqlite on web.

console.warn('[database.web] Using stub DB – SQLite is not available on web/debug.');

export const initializeDatabase = async () => {};

export const getListsFromDb = async () => {
  return [];
};

export const getListSummaryFromDb = async (_listId: string) => {
  return null; // native: Promise<Summary | null>
};

export const saveListSummaryToDb = async (_list: any) => {};

export const replaceListsInDb = async (_lists: any[]) => {};

export const deleteListsFromDb = async (_ids: string[]) => {};

export const updateListPinnedInDb = async (_ids: string[], _pinned: boolean) => {};

export const replaceContactsInDb = async (_contacts: any[]) => {};

export const getContactsFromDb = async () => {
  return [];
};

export const upsertConversationInDb = async (_conversation: any) => {};

export const getRecentConversationsFromDb = async () => {
  return [];
};

export const saveMessagesToDb = async (_messages: any[]) => {};

export const getMessagesForConversationFromDb = async () => {
  return [];
};

export const updateMessageFlagsInDb = async () => {};

export const updateMessageDeletionInDb = async () => {};

export const deleteMessagesFromDb = async () => {};

export const setConversationUnreadInDb = async () => {};

export const upsertUserProfileInDb = async (_profile: any) => {};

export const getUserProfileFromDb = async (_userId: number) => {
  return null;
};