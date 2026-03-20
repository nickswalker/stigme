import { openDB, type IDBPDatabase } from 'idb'

export interface TapRecord {
  id?: number
  counterId: string
  timestamp: number
  value: number  // +step or -step
}

export interface NoteRecord {
  id?: number
  text: string
  timestamp: number
  counterName: string  // name of active counter at time of note
}

export interface Counter {
  id: string
  name: string
  createdAt: number
  step: number
}

const DB_NAME = 'stigme'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const tapStore = db.createObjectStore('taps', {
            keyPath: 'id',
            autoIncrement: true,
          })
          tapStore.createIndex('by-counter', 'counterId')
          tapStore.createIndex('by-timestamp', 'timestamp')

          const counterStore = db.createObjectStore('counters', { keyPath: 'id' })
          counterStore.createIndex('by-created', 'createdAt')
        }
        // v2: added `value` field to TapRecord — no schema changes needed
        if (oldVersion < 3) {
          const noteStore = db.createObjectStore('notes', {
            keyPath: 'id',
            autoIncrement: true,
          })
          noteStore.createIndex('by-timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

export async function getCounters(): Promise<Counter[]> {
  const db = await getDb()
  return db.getAllFromIndex('counters', 'by-created')
}

export async function getCounter(id: string): Promise<Counter | undefined> {
  const db = await getDb()
  return db.get('counters', id)
}

export async function saveCounter(counter: Counter): Promise<void> {
  const db = await getDb()
  await db.put('counters', counter)
}

export async function deleteCounter(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['counters', 'taps'], 'readwrite')
  await tx.objectStore('counters').delete(id)
  const taps = await tx.objectStore('taps').index('by-counter').getAllKeys(id)
  for (const key of taps) {
    await tx.objectStore('taps').delete(key)
  }
  await tx.done
}

export async function addTap(counterId: string, value: number): Promise<TapRecord> {
  const db = await getDb()
  const record: TapRecord = { counterId, timestamp: Date.now(), value }
  record.id = (await db.add('taps', record)) as number
  return record
}

export async function removeTap(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('taps', id)
}

export async function getCount(counterId: string): Promise<number> {
  const db = await getDb()
  const records = await db.getAllFromIndex('taps', 'by-counter', counterId)
  return records.reduce((sum, r) => sum + (r.value ?? 1), 0)
}

export async function getTapsForCounter(counterId: string): Promise<TapRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('taps', 'by-counter', counterId)
}

export async function clearTaps(counterId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('taps', 'readwrite')
  const keys = await tx.store.index('by-counter').getAllKeys(counterId)
  for (const key of keys) {
    await tx.store.delete(key)
  }
  await tx.done
}

export async function addNote(text: string, counterName: string): Promise<NoteRecord> {
  const db = await getDb()
  const record: NoteRecord = { text, timestamp: Date.now(), counterName }
  record.id = (await db.add('notes', record)) as number
  return record
}

export async function getNotes(): Promise<NoteRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-timestamp')
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('notes', id)
}
