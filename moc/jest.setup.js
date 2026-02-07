jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    withExclusiveTransactionAsync: jest.fn(async cb =>
      cb({
        runAsync: jest.fn(),
        execAsync: jest.fn(),
        getAllAsync: jest.fn(async () => []),
        getFirstAsync: jest.fn(async () => null),
      }),
    ),
  })),
}));