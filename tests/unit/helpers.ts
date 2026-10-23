import { openDatabase, setDb } from '@app/server/db';

/** A fresh in-memory database for every test */
export function useTestDb() {
  const instance = openDatabase(':memory:');
  setDb(instance);
  return instance;
}
