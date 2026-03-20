import { openDB, type IDBPDatabase } from 'idb'

export interface TapRecord {
  id?: number
  counterId: string
  timestamp: number
}

export interface Counter {
  id: string
  name: string
  createdAt: number
  step: number
}

const DB_NAME = 'stigme'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const tapStore = db.createObjectStore('taps', {
          keyPath: 'id',
          autoIncrement: true,
        })
        tapStore.createIndex('by-counter', 'counterId')
        tapStore.createIndex('by-timestamp', 'timestamp')

        const counterStore = db.createObjectStore('counters', { keyPath: 'id' })
        counterStore.createIndex('by-created', 'createdAt')
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

export async function addTap(counterId: string): Promise<TapRecord> {
  const db = await getDb()
  const record: TapRecord = { counterId, timestamp: Date.now() }
  record.id = (await db.add('taps', record)) as number
  return record
}

export async function removeTap(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('taps', id)
}

export async function getLastTap(counterId: string): Promise<TapRecord | undefined> {
  const db = await getDb()
  const all = await db.getAllFromIndex('taps', 'by-counter', counterId)
  return all[all.length - 1]
}

export async function getTapsForCounter(counterId: string): Promise<TapRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('taps', 'by-counter', counterId)
}

export async function getTapCount(counterId: string): Promise<number> {
  const db = await getDb()
  return db.countFromIndex('taps', 'by-counter', counterId)
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
