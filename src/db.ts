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
  counterId: string  // id of the counter the note belongs to
}

export interface Counter {
  id: string
  name: string
  createdAt: number
  step: number
  order?: number
  colorIndex?: number
  customHue?: number
}

const DB_NAME = 'stigme'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // v4 is a clean schema. Any pre-v4 data (which lacked note→counter
      // associations and un-backfilled tap values) is discarded and the
      // stores are recreated with the current shape.
      upgrade(db) {
        for (const name of ['taps', 'counters', 'notes']) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name)
        }

        const tapStore = db.createObjectStore('taps', {
          keyPath: 'id',
          autoIncrement: true,
        })
        tapStore.createIndex('by-counter', 'counterId')
        tapStore.createIndex('by-timestamp', 'timestamp')

        const counterStore = db.createObjectStore('counters', { keyPath: 'id' })
        counterStore.createIndex('by-created', 'createdAt')

        const noteStore = db.createObjectStore('notes', {
          keyPath: 'id',
          autoIncrement: true,
        })
        noteStore.createIndex('by-timestamp', 'timestamp')
        noteStore.createIndex('by-counter', 'counterId')
      },
    })
  }
  return dbPromise
}

export async function getCounters(): Promise<Counter[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('counters', 'by-created')
  return all.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
}

export async function saveCounters(counters: Counter[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('counters', 'readwrite')
  await Promise.all(counters.map(c => tx.store.put(c)))
  await tx.done
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
  const tx = db.transaction(['counters', 'taps', 'notes'], 'readwrite')
  await tx.objectStore('counters').delete(id)
  for (const store of ['taps', 'notes'] as const) {
    const keys = await tx.objectStore(store).index('by-counter').getAllKeys(id)
    for (const key of keys) {
      await tx.objectStore(store).delete(key)
    }
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
  return records.reduce((sum, r) => sum + r.value, 0)
}

export async function getTapsForCounter(counterId: string): Promise<TapRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('taps', 'by-counter', counterId)
}

export async function getAllTaps(): Promise<TapRecord[]> {
  const db = await getDb()
  return db.getAll('taps')
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

export async function addNote(text: string, counterId: string): Promise<NoteRecord> {
  const db = await getDb()
  const record: NoteRecord = { text, timestamp: Date.now(), counterId }
  record.id = (await db.add('notes', record)) as number
  return record
}

export async function getNotes(): Promise<NoteRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-timestamp')
}

export async function getNotesForCounter(counterId: string): Promise<NoteRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-counter', counterId)
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('notes', id)
}

export async function clearAllData(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('taps'),
    db.clear('notes'),
    db.clear('counters'),
  ])
}
