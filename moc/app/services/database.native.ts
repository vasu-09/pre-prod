import * as SQLite from 'expo-sqlite';

export type ListRecordInput = {
  id: string;
  title: string;
  listType?: string | null;
  pinned?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByUserId?: string | null;
  description?: string | null;
  members?: ListMemberRecordInput[] | null;
  membersJson?: string | null;
};

export type ListMemberRecordInput = {
  id?: string | number | null;
  name?: string | null;
  img?: string | null;
  phone?: string | null;
};

export type ListItemRecordInput = {
  id?: string | number | null;
  itemName?: string | null;
  quantity?: string | null;
  priceText?: string | null;
  subQuantities?: { quantity?: string | null; priceText?: string | null }[] | null;
  subQuantitiesJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ListSummaryInput = ListRecordInput & {
  items?: ListItemRecordInput[];
};

type ListRow = {
  id: string;
  title: string;
  list_type: string | null;
  pinned: number;
  created_at: string | null;
  updated_at: string | null;
  created_by_user_id: string | null;
  description: string | null;
  members_json: string | null;
};

type ItemRow = {
  id: string;
  list_id: string;
  item_name: string;
  quantity: string | null;
  price_text: string | null;
  sub_quantities_json: string | null;
  created_at: string | null;
  updated_at: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitialized = false;
let localItemCounter = 0;
let localContactCounter = 0;
let writeQueue: Promise<unknown> = Promise.resolve();

const DB_NAME = 'moc-app.db';
const CURRENT_SCHEMA_VERSION = 6;

type MetaRow = {
  value: string;
};

type ConversationRow = {
  id: number;
  room_key: string;
  title: string | null;
  peer_id: number | null;
  peer_phone: string | null;
  avatar: string | null;
  unread_count: number;
  created_at: string | null;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: number;
  sender_id: number | null;
  plaintext: string | null;
  ciphertext: string | null;
  aad: string | null;
  iv: string | null;
  key_ref: string | null;
  sender_device_id?: string | null;
  e2ee: number;
  created_at: string | null;
  pending: number;
  error: number;
  read_by_peer: number;
  deleted_by_sender: number;
  deleted_by_receiver: number;
  deleted_for_everyone: number;
  system_message: number;
  reply_to_message_id: string | null;
  reply_to_sender_id: number | null;
  reply_to_preview: string | null;
};

type UserProfileRow = {
  user_id: number;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  updated_at: string | null;
};

const runWithWriteLock = async <T>(task: () => Promise<T>): Promise<T> => {
  const next = writeQueue.then(task);

  writeQueue = next.catch((err) => {
    console.warn('DB write failed, continuing queue', err);
  });

  return next;
};

export type ConversationRecordInput = {
  id: number;
  roomKey: string;
  title?: string | null;
  peerId?: number | null;
  peerPhone?: string | null;
  avatar?: string | null;
  unreadCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type StoredConversationSummary = ConversationRecordInput & {
  lastMessage?: {
    id: string;
    plaintext: string | null;
    ciphertext: string | null;
    createdAt: string | null;
    senderId: number | null;
    e2ee: boolean;
  } | null;
};

export type MessageRecordInput = {
  id: string;
  conversationId: number | null;
  senderId?: number | null;
  plaintext?: string | null;
  ciphertext?: string | null;
  aad?: string | null;
  iv?: string | null;
  keyRef?: string | null;
  senderDeviceId?: string | null;
  e2ee?: boolean;
  createdAt?: string | null;
  pending?: boolean;
  error?: boolean;
  readByPeer?: boolean;
  deletedBySender?: boolean;
  deletedByReceiver?: boolean;
  deletedForEveryone?: boolean;
  systemMessage?: boolean;
  replyToMessageId?: string | null;
  replyToSenderId?: number | null;
  replyToPreview?: string | null;
};

const ensureMetaTable = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
};

const getSchemaVersion = async (db: SQLite.SQLiteDatabase): Promise<number> => {
  const row = await db.getFirstAsync<MetaRow>('SELECT value FROM meta WHERE key = ?', ['schema_version']);
  if (!row) {
    return 0;
  }
  const parsed = Number(row.value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const setSchemaVersion = async (db: SQLite.SQLiteDatabase, version: number) => {
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)],
  );
};

const migrateToV1 = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      list_type TEXT,
      pinned INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      created_by_user_id TEXT,
      description TEXT,
      members_json TEXT
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS list_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity TEXT,
      price_text TEXT,
      sub_quantities_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_numbers_json TEXT,
      image_uri TEXT,
      match_phone TEXT,
      match_user_id INTEGER,
      updated_at TEXT
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY,
      room_key TEXT NOT NULL UNIQUE,
      title TEXT,
      peer_id INTEGER,
      avatar TEXT,
      peer_phone TEXT,
      unread_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER,
      plaintext TEXT,
      ciphertext TEXT,
      aad TEXT,
      iv TEXT,
      key_ref TEXT,
      e2ee INTEGER DEFAULT 0,
      created_at TEXT,
      pending INTEGER DEFAULT 0,
      error INTEGER DEFAULT 0,
      read_by_peer INTEGER DEFAULT 0,
      reply_to_message_id TEXT,
      reply_to_sender_id INTEGER,
      reply_to_preview TEXT,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON messages (conversation_id, created_at DESC)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_read ON messages (conversation_id, read_by_peer)',
  );
};

const migrateToV2 = async (db: SQLite.SQLiteDatabase) => {
  try {
    await db.execAsync('ALTER TABLE conversations ADD COLUMN peer_phone TEXT;');
  } catch (error) {
    // Ignore if the column already exists
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping peer_phone migration', error);
    }
  }
};

const migrateToV3 = async (db: SQLite.SQLiteDatabase) => {
  try {
    await db.execAsync('ALTER TABLE lists ADD COLUMN description TEXT;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping description migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE lists ADD COLUMN members_json TEXT;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping members_json migration', error);
    }
  }
};

const migrateToV4 = async (db: SQLite.SQLiteDatabase) => {
  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN deleted_by_sender INTEGER DEFAULT 0;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping deleted_by_sender migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN deleted_by_receiver INTEGER DEFAULT 0;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping deleted_by_receiver migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN deleted_for_everyone INTEGER DEFAULT 0;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping deleted_for_everyone migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN system_message INTEGER DEFAULT 0;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping system_message migration', error);
    }
  }
};

const migrateToV5 = async (db: SQLite.SQLiteDatabase) => {
  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping reply_to_message_id migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN reply_to_sender_id INTEGER;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping reply_to_sender_id migration', error);
    }
  }

  try {
    await db.execAsync('ALTER TABLE messages ADD COLUMN reply_to_preview TEXT;');
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Skipping reply_to_preview migration', error);
    }
  }
};

const migrateToV6 = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      phone_number TEXT,
      updated_at TEXT
    );
  `);
};

const runMigrations = async (db: SQLite.SQLiteDatabase) => {
  await ensureMetaTable(db);
  let version = await getSchemaVersion(db);

  if (version >= CURRENT_SCHEMA_VERSION) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
    if (version < 1) {
      await migrateToV1(tx);
      version = 1;
    }
    if (version < 2) {
      await migrateToV2(tx);
      version = 2;
    }
    if (version < 3) {
      await migrateToV3(tx);
      version = 3;
    }
    if (version < 4) {
      await migrateToV4(tx);
      version = 4;
    }
    if (version < 5) {
      await migrateToV5(tx);
      version = 5;
    }
    if (version < 6) {
      await migrateToV6(tx);
      version = 6;
    }
    await setSchemaVersion(tx, version);
  });
};

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  const db = await dbPromise;

  if (!isInitialized) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    isInitialized = true;
  }

  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  await getDatabase();
};

const generateLocalItemId = (listId: string): string => {
  localItemCounter += 1;
  return `local-${listId}-${Date.now()}-${localItemCounter}`;
};

const parseSubQuantities = (value: string | null): { quantity?: string | null; priceText?: string | null }[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as { quantity?: string | null; priceText?: string | null }[];
    }
  } catch (error) {
    console.warn('Failed to parse stored sub quantities', error);
  }

  return [];
};

const parseListMembers = (value: string | null): ListMemberRecordInput[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as ListMemberRecordInput[];
    }
  } catch (error) {
    console.warn('Failed to parse stored list members', error);
  }

  return [];
};

const serializeSubQuantities = (
  input?: { quantity?: string | null; priceText?: string | null }[] | null,
  fallbackJson?: string | null,
): string | null => {
  if (Array.isArray(input)) {
    try {
      return JSON.stringify(input);
    } catch (error) {
      console.warn('Failed to serialize sub quantities', error);
      return fallbackJson ?? null;
    }
  }

  return fallbackJson ?? null;
};

const serializeListMembers = (
  input?: ListMemberRecordInput[] | null,
  fallbackJson?: string | null,
): string | null => {
  if (Array.isArray(input)) {
    try {
      return JSON.stringify(input);
    } catch (error) {
      console.warn('Failed to serialize list members', error);
      return fallbackJson ?? null;
    }
  }

  return fallbackJson ?? null;
};

const generateLocalContactId = (): string => {
  localContactCounter += 1;
  return `local-contact-${Date.now()}-${localContactCounter}`;
};

const mapConversationRow = (row: ConversationRow): ConversationRecordInput => ({
  id: row.id,
  roomKey: row.room_key,
  title: row.title,
  peerId: row.peer_id,
  peerPhone: row.peer_phone,
  avatar: row.avatar,
  unreadCount: row.unread_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapMessageRow = (row: MessageRow): MessageRecordInput => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  plaintext: row.plaintext,
  ciphertext: row.ciphertext,
  aad: row.aad,
  iv: row.iv,
  keyRef: row.key_ref,
  senderDeviceId: row.sender_device_id ?? null,
  e2ee: row.e2ee === 1,
  createdAt: row.created_at,
  pending: row.pending === 1,
  error: row.error === 1,
  readByPeer: row.read_by_peer === 1,
  deletedBySender: row.deleted_by_sender === 1,
  deletedByReceiver: row.deleted_by_receiver === 1,
  deletedForEveryone: row.deleted_for_everyone === 1,
  systemMessage: row.system_message === 1,
  replyToMessageId: row.reply_to_message_id,
  replyToSenderId: row.reply_to_sender_id,
  replyToPreview: row.reply_to_preview,
});

export const upsertConversationInDb = async (conversation: ConversationRecordInput): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO conversations (id, room_key, title, peer_id, peer_phone, avatar, unread_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         room_key = excluded.room_key,
         title = excluded.title,
         peer_id = excluded.peer_id,
         peer_phone = COALESCE(excluded.peer_phone, conversations.peer_phone),
         avatar = excluded.avatar,
         unread_count = excluded.unread_count,
         updated_at = COALESCE(excluded.updated_at, conversations.updated_at)`,
      [
        conversation.id,
        conversation.roomKey,
        conversation.title ?? null,
        conversation.peerId ?? null,
        conversation.peerPhone ?? null,
        conversation.avatar ?? null,
        conversation.unreadCount ?? 0,
        conversation.createdAt ?? new Date().toISOString(),
        conversation.updatedAt ?? new Date().toISOString(),
      ],
    );
  });

export const setConversationUnreadInDb = async (roomKey: string, unreadCount: number): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync('UPDATE conversations SET unread_count = ? WHERE room_key = ?', [unreadCount, roomKey]);
  });

export const getRecentConversationsFromDb = async (
  limit = 50,
): Promise<StoredConversationSummary[]> => {
  const db = await getDatabase();

  const rows = await db.getAllAsync<
    ConversationRow & {
      last_message_id: string | null;
      last_plaintext: string | null;
      last_ciphertext: string | null;
      last_sender_id: number | null;
      last_created_at: string | null;
      last_e2ee: number | null;
    }
  >(
    `WITH latest AS (
        SELECT conversation_id, MAX(created_at) AS created_at
        FROM messages
        GROUP BY conversation_id
      )
      SELECT c.*, m.id AS last_message_id, m.plaintext AS last_plaintext, m.ciphertext AS last_ciphertext,
             m.sender_id AS last_sender_id, m.created_at AS last_created_at, m.e2ee AS last_e2ee
      FROM conversations c
      LEFT JOIN latest l ON l.conversation_id = c.id
      LEFT JOIN messages m ON m.conversation_id = l.conversation_id AND m.created_at = l.created_at
      ORDER BY COALESCE(l.created_at, c.updated_at, c.created_at) DESC
      LIMIT ?`,
    [limit],
  );

  return (
    rows?.map((row) => ({
      ...mapConversationRow(row),
      lastMessage:
        row.last_message_id != null
          ? {
              id: row.last_message_id,
              plaintext: row.last_plaintext,
              ciphertext: row.last_ciphertext,
              createdAt: row.last_created_at,
              senderId: row.last_sender_id,
              e2ee: row.last_e2ee === 1,
            }
          : null,
    })) ?? []
  );
};

export const saveMessagesToDb = async (messages: MessageRecordInput[]): Promise<void> =>
  runWithWriteLock(async () => {
    if (!messages.length) {
      return;
    }

    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
      for (const message of messages) {
        await tx.runAsync(
          `INSERT INTO messages (id, conversation_id, sender_id, plaintext, ciphertext, aad, iv, key_ref, e2ee, created_at, pending, error, read_by_peer, deleted_by_sender, deleted_by_receiver, deleted_for_everyone, system_message, reply_to_message_id, reply_to_sender_id, reply_to_preview)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             conversation_id = excluded.conversation_id,
             sender_id = excluded.sender_id,
             plaintext = excluded.plaintext,
             ciphertext = excluded.ciphertext,
             aad = excluded.aad,
             iv = excluded.iv,
             key_ref = excluded.key_ref,
             e2ee = excluded.e2ee,
             created_at = COALESCE(excluded.created_at, messages.created_at),
             pending = excluded.pending,
             error = excluded.error,
             read_by_peer = COALESCE(excluded.read_by_peer, messages.read_by_peer),
             deleted_by_sender = COALESCE(excluded.deleted_by_sender, messages.deleted_by_sender),
             deleted_by_receiver = COALESCE(excluded.deleted_by_receiver, messages.deleted_by_receiver),
             deleted_for_everyone = COALESCE(excluded.deleted_for_everyone, messages.deleted_for_everyone),
             system_message = COALESCE(excluded.system_message, messages.system_message),
             reply_to_message_id = COALESCE(excluded.reply_to_message_id, messages.reply_to_message_id),
             reply_to_sender_id = COALESCE(excluded.reply_to_sender_id, messages.reply_to_sender_id),
             reply_to_preview = COALESCE(excluded.reply_to_preview, messages.reply_to_preview)
          `,
          [
            message.id,
            message.conversationId,
            message.senderId ?? null,
            message.plaintext ?? null,
            message.ciphertext ?? null,
            message.aad ?? null,
            message.iv ?? null,
            message.keyRef ?? null,
            message.e2ee ? 1 : 0,
            message.createdAt ?? new Date().toISOString(),
            message.pending ? 1 : 0,
            message.error ? 1 : 0,
            message.readByPeer ? 1 : 0,
            message.deletedBySender ? 1 : 0,
            message.deletedByReceiver ? 1 : 0,
            message.deletedForEveryone ? 1 : 0,
            message.systemMessage ? 1 : 0,
            message.replyToMessageId ?? null,
            message.replyToSenderId ?? null,
            message.replyToPreview ?? null,
          ],
        );
      }
    });
  });

export const updateMessageFlagsInDb = async (
  messageId: string,
  updates: { pending?: boolean; error?: boolean; readByPeer?: boolean },
): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.pending !== undefined) {
      fields.push('pending = ?');
      params.push(updates.pending ? 1 : 0);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      params.push(updates.error ? 1 : 0);
    }
    if (updates.readByPeer !== undefined) {
      fields.push('read_by_peer = ?');
      params.push(updates.readByPeer ? 1 : 0);
    }

    if (!fields.length) {
      return;
    }

    await db.runAsync(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, [...params, messageId]);
  });

  export const updateMessageDeletionInDb = async (
  messageId: string,
  updates: {
    deletedBySender?: boolean;
    deletedByReceiver?: boolean;
    deletedForEveryone?: boolean;
    systemMessage?: boolean;
  },
): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.deletedBySender !== undefined) {
      fields.push('deleted_by_sender = ?');
      params.push(updates.deletedBySender ? 1 : 0);
    }
    if (updates.deletedByReceiver !== undefined) {
      fields.push('deleted_by_receiver = ?');
      params.push(updates.deletedByReceiver ? 1 : 0);
    }
    if (updates.deletedForEveryone !== undefined) {
      fields.push('deleted_for_everyone = ?');
      params.push(updates.deletedForEveryone ? 1 : 0);
    }
    if (updates.systemMessage !== undefined) {
      fields.push('system_message = ?');
      params.push(updates.systemMessage ? 1 : 0);
    }

    if (!fields.length) {
      return;
    }

    await db.runAsync(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, [...params, messageId]);
  });

export const deleteMessagesFromDb = async (messageIds: string[]): Promise<void> =>
  runWithWriteLock(async () => {
    if (!messageIds.length) {
      return;
    }
    const db = await getDatabase();
    const placeholders = messageIds.map(() => '?').join(', ');
    await db.runAsync(`DELETE FROM messages WHERE id IN (${placeholders})`, messageIds);
  });

export const getMessagesForConversationFromDb = async (
  conversationId: number,
  limit = 50,
): Promise<MessageRecordInput[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    [conversationId, limit],
  );

  return rows?.map(mapMessageRow).reverse() ?? [];
};

export type StoredContactInput = {
  id?: string | null;
  name: string;
  phoneNumbers?: { label?: string | null; number: string }[];
  imageUri?: string | null;
  matchPhone?: string | null;
  matchUserId?: number | null;
  updatedAt?: string | null;
};

export type StoredUserProfileInput = {
  userId: number;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  updatedAt?: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  phone_numbers_json: string | null;
  image_uri: string | null;
  match_phone: string | null;
  match_user_id: number | null;
  updated_at: string | null;
};

const normalizeMatchUserId = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deserializeContactRow = (row: ContactRow): StoredContactInput => {
  let phoneNumbers: { label?: string | null; number: string }[] | undefined;

  if (row.phone_numbers_json) {
    try {
      const parsed = JSON.parse(row.phone_numbers_json);
      if (Array.isArray(parsed)) {
        phoneNumbers = parsed
          .filter((entry) => Boolean(entry?.number))
          .map((entry) => ({ number: String(entry.number), label: entry?.label ?? null }));
      }
    } catch (error) {
      console.warn('Unable to parse stored phone numbers for contact', row.id, error);
    }
  }

  return {
    id: row.id,
    name: row.name,
    phoneNumbers,
    imageUri: row.image_uri,
    matchPhone: row.match_phone,
    matchUserId: normalizeMatchUserId(row.match_user_id),
    updatedAt: row.updated_at,
  } as StoredContactInput;
};

export const getListsFromDb = async (): Promise<{ id: string; title: string; listType: string | null; pinned: boolean; createdAt: string | null; updatedAt: string | null; createdByUserId: string | null; description: string | null; members: ListMemberRecordInput[] }[]> => {
  const db = await getDatabase();
  const rows = (await db.getAllAsync<ListRow>('SELECT * FROM lists ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, title COLLATE NOCASE ASC')) ?? [];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    listType: row.list_type,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    description: row.description,
    members: parseListMembers(row.members_json),
  }));
};

export const replaceListsInDb = async (lists: ListRecordInput[]): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();

    await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
      if (!lists.length) {
        await tx.runAsync('DELETE FROM list_items');
        await tx.runAsync('DELETE FROM lists');
        return;
      }

      const listIds = lists.map((list) => list.id);
      const placeholders = listIds.map(() => '?').join(',');

      await tx.runAsync(`DELETE FROM list_items WHERE list_id NOT IN (${placeholders})`, listIds);
      await tx.runAsync(`DELETE FROM lists WHERE id NOT IN (${placeholders})`, listIds);

      for (const list of lists) {
              const pinnedValue = list.pinned ? 1 : 0;
              const membersJson = serializeListMembers(list.members ?? null, list.membersJson ?? null);
              await tx.runAsync(
                `INSERT INTO lists (id, title, list_type, pinned, created_at, updated_at, created_by_user_id, description, members_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title,
                  list_type = excluded.list_type,
                  pinned = excluded.pinned,
                  created_at = COALESCE(excluded.created_at, lists.created_at),
                  updated_at = COALESCE(excluded.updated_at, lists.updated_at),
                   created_by_user_id = COALESCE(excluded.created_by_user_id, lists.created_by_user_id),
                  description = COALESCE(excluded.description, lists.description),
                  members_json = COALESCE(excluded.members_json, lists.members_json)
                `,
                [
                  list.id,
                  list.title,
                  list.listType ?? null,
                  pinnedValue,
                  list.createdAt ?? null,
                  list.updatedAt ?? null,
                  list.createdByUserId ?? null,
                  list.description ?? null,
                  membersJson,
                ],
              );
            }
          });
        });

export const updateListPinnedInDb = async (listIds: string[], pinned: boolean): Promise<void> =>
  runWithWriteLock(async () => {
    if (!listIds.length) {
      return;
    }

    const db = await getDatabase();
      const placeholders = listIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE lists SET pinned = ? WHERE id IN (${placeholders})`,
        [pinned ? 1 : 0, ...listIds],
      );
    });

export const deleteListsFromDb = async (listIds: string[]): Promise<void> =>
  runWithWriteLock(async () => {
    if (!listIds.length) {
      return;
    }

    const db = await getDatabase();
    const placeholders = listIds.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM list_items WHERE list_id IN (${placeholders})`, listIds);
    await db.runAsync(`DELETE FROM lists WHERE id IN (${placeholders})`, listIds);
  });

export const getListSummaryFromDb = async (
  listId: string,
): Promise<{
  id: string;
  title: string;
  listType: string | null;
  pinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUserId: string | null;
  description: string | null;
  members: ListMemberRecordInput[];
  items: {
    id: string;
    itemName: string;
    quantity: string | null;
    priceText: string | null;
    subQuantities: { quantity?: string | null; priceText?: string | null }[];
    createdAt: string | null;
    updatedAt: string | null;
  }[];
} | null> => {
  const db = await getDatabase();
  const listRow = await db.getFirstAsync<ListRow>('SELECT * FROM lists WHERE id = ?', [listId]);

  if (!listRow) {
    return null;
  }

  const itemRows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM list_items WHERE list_id = ? ORDER BY COALESCE(updated_at, created_at) DESC, item_name COLLATE NOCASE ASC',
    [listId],
  );

  const items = itemRows?.map((row) => ({
    id: row.id,
    itemName: row.item_name,
    quantity: row.quantity,
    priceText: row.price_text,
    subQuantities: parseSubQuantities(row.sub_quantities_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) ?? [];

  return {
    id: listRow.id,
    title: listRow.title,
    listType: listRow.list_type,
    pinned: listRow.pinned === 1,
    createdAt: listRow.created_at,
    updatedAt: listRow.updated_at,
    createdByUserId: listRow.created_by_user_id,
    items,
    description: listRow.description,
    members: parseListMembers(listRow.members_json),
  };
};

export const saveListSummaryToDb = async (summary: ListSummaryInput): Promise<void> =>
  runWithWriteLock(async () => {
    if (!summary.id) {
      return;
    }

    const db = await getDatabase();
    const normalizedId = summary.id;

      await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
      const existing = await tx.getFirstAsync<{ pinned: number }>('SELECT pinned FROM lists WHERE id = ?', [normalizedId]);
      const pinnedValue = summary.pinned != null ? (summary.pinned ? 1 : 0) : existing?.pinned ?? 0;
      const membersJson = serializeListMembers(summary.members ?? null, summary.membersJson ?? null);

      await tx.runAsync(
        `INSERT INTO lists (id, title, list_type, pinned, created_at, updated_at, created_by_user_id, description, members_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           list_type = excluded.list_type,
           pinned = excluded.pinned,
           created_at = COALESCE(excluded.created_at, lists.created_at),
           updated_at = COALESCE(excluded.updated_at, lists.updated_at),
           created_by_user_id = COALESCE(excluded.created_by_user_id, lists.created_by_user_id),
           description = COALESCE(excluded.description, lists.description),
           members_json = COALESCE(excluded.members_json, lists.members_json)
        `,
        [
          normalizedId,
          summary.title,
          summary.listType ?? null,
          pinnedValue,
          summary.createdAt ?? null,
          summary.updatedAt ?? null,
          summary.createdByUserId ?? null,
          summary.description ?? null,
          membersJson,
        ],
      );

    if (summary.items) {
        await tx.runAsync('DELETE FROM list_items WHERE list_id = ?', [normalizedId]);

        for (const item of summary.items) {
          const itemId = item.id != null ? String(item.id) : generateLocalItemId(normalizedId);
          const json = serializeSubQuantities(item.subQuantities ?? null, item.subQuantitiesJson ?? null);
          await tx.runAsync(
            `INSERT INTO list_items (id, list_id, item_name, quantity, price_text, sub_quantities_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               item_name = excluded.item_name,
               quantity = excluded.quantity,
               price_text = excluded.price_text,
               sub_quantities_json = excluded.sub_quantities_json,
               created_at = COALESCE(excluded.created_at, list_items.created_at),
               updated_at = COALESCE(excluded.updated_at, list_items.updated_at)
            `,
            [
              itemId,
              normalizedId,
              item.itemName ?? 'Untitled Item',
              item.quantity ?? null,
              item.priceText ?? null,
              json,
              item.createdAt ?? null,
              item.updatedAt ?? null,
            ],
          );
        }
      }
    });
  });

export const replaceContactsInDb = async (contacts: StoredContactInput[]): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();

    await db.withExclusiveTransactionAsync(async (tx: SQLite.SQLiteDatabase) => {
      await tx.runAsync('DELETE FROM contacts');

      for (const contact of contacts) {
        const normalizedId = contact.id ? String(contact.id) : generateLocalContactId();
        let phoneJson: string | null = null;

        if (Array.isArray(contact.phoneNumbers)) {
          try {
            const cleaned = contact.phoneNumbers
              .filter((entry) => Boolean(entry?.number))
              .map((entry) => ({
                number: entry?.number ?? '',
                label: entry?.label ?? null,
              }));
            phoneJson = cleaned.length ? JSON.stringify(cleaned) : null;
          } catch (error) {
            console.warn('Unable to serialize phone numbers for contact', contact?.id ?? contact?.name, error);
            phoneJson = null;
          }
        }

      
        await tx.runAsync(
          `INSERT INTO contacts (id, name, phone_numbers_json, image_uri, match_phone, match_user_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone_numbers_json = excluded.phone_numbers_json,
             image_uri = excluded.image_uri,
             match_phone = excluded.match_phone,
             match_user_id = excluded.match_user_id,
             updated_at = COALESCE(excluded.updated_at, contacts.updated_at)
          `,
          [
            normalizedId,
            contact.name,
            phoneJson,
            contact.imageUri ?? null,
            contact.matchPhone ?? null,
            normalizeMatchUserId(contact.matchUserId),
            contact.updatedAt ?? new Date().toISOString(),
          ],
        );
      }
    });
  });

export const getContactsFromDb = async (): Promise<StoredContactInput[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ContactRow>('SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC');

  return rows?.map(deserializeContactRow) ?? [];
};

export const searchContactsInDb = async (query: string): Promise<StoredContactInput[]> => {
  const db = await getDatabase();
  
  const trimmed = query.trim();

  if (!trimmed) {
    const rows = await db.getAllAsync<ContactRow>('SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC');
    return rows?.map(deserializeContactRow) ?? [];
  }

  const lower = trimmed.toLowerCase();
  const like = `%${lower}%`;
  const digits = trimmed.replace(/\D/g, '');
  const digitsLike = digits ? `%${digits}%` : null;

  console.log('[DB_SEARCH] query=', trimmed, 'digits=', digits);

  const params: (string | null)[] = [like, like, like];
  let sql = `
    SELECT *
    FROM contacts
    WHERE LOWER(name) LIKE ?
       OR LOWER(IFNULL(phone_numbers_json, '')) LIKE ?
       OR LOWER(IFNULL(match_phone, '')) LIKE ?
  `;

  if (digitsLike) {
    sql += `
       OR REPLACE(REPLACE(REPLACE(IFNULL(phone_numbers_json, ''), ' ', ''), '-', ''), '+', '') LIKE ?
       OR REPLACE(REPLACE(REPLACE(IFNULL(match_phone, ''), ' ', ''), '-', ''), '+', '') LIKE ?
    `;
    params.push(digitsLike, digitsLike);
  }

  sql += ' ORDER BY name COLLATE NOCASE ASC';

  const rows = await db.getAllAsync<ContactRow>(sql, params);

  console.log('[DB_SEARCH] rows found =', rows?.length ?? 0);

  return rows?.map(deserializeContactRow) ?? [];
};

export const upsertUserProfileInDb = async (profile: StoredUserProfileInput): Promise<void> =>
  runWithWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO user_profile (user_id, display_name, email, avatar_url, phone_number, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, user_profile.display_name),
         email = COALESCE(excluded.email, user_profile.email),
         avatar_url = COALESCE(excluded.avatar_url, user_profile.avatar_url),
         phone_number = COALESCE(excluded.phone_number, user_profile.phone_number),
         updated_at = COALESCE(excluded.updated_at, user_profile.updated_at)`,
      [
        profile.userId,
        profile.displayName ?? null,
        profile.email ?? null,
        profile.avatarUrl ?? null,
        profile.phoneNumber ?? null,
        profile.updatedAt ?? new Date().toISOString(),
      ],
    );
  });

export const getUserProfileFromDb = async (userId: number): Promise<StoredUserProfileInput | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserProfileRow>('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    phoneNumber: row.phone_number,
    updatedAt: row.updated_at,
  };
};