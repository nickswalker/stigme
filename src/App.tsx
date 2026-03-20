import { useState, useEffect, useCallback } from 'react'
import { CounterView } from './CounterView'
import { CounterList } from './CounterList'
import { getCounters, saveCounter, deleteCounter, type Counter } from './db'
import './App.css'

export default function App() {
  const [counters, setCounters] = useState<Counter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'counter' | 'list'>('counter')

  useEffect(() => {
    getCounters().then(list => {
      if (list.length === 0) {
        const defaultCounter: Counter = {
          id: crypto.randomUUID(),
          name: 'Counter',
          createdAt: Date.now(),
          step: 1,
        }
        saveCounter(defaultCounter).then(() => {
          setCounters([defaultCounter])
          setActiveId(defaultCounter.id)
        })
      } else {
        setCounters(list)
        setActiveId(list[0].id)
      }
    })
  }, [])

  const addCounter = useCallback(async () => {
    const counter: Counter = {
      id: crypto.randomUUID(),
      name: `Counter ${counters.length + 1}`,
      createdAt: Date.now(),
      step: 1,
    }
    await saveCounter(counter)
    setCounters(prev => [...prev, counter])
    setActiveId(counter.id)
    setView('counter')
  }, [counters.length])

  const removeCounter = useCallback(async (id: string) => {
    await deleteCounter(id)
    setCounters(prev => {
      const next = prev.filter(c => c.id !== id)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
  }, [activeId])

  const selectCounter = useCallback((id: string) => {
    setActiveId(id)
    setView('counter')
  }, [])

  const onCounterUpdate = useCallback((updated: Counter) => {
    setCounters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [])

  if (!activeId) return null

  return (
    <div className="app">
      {view === 'counter' ? (
        <CounterView
          key={activeId}
          counterId={activeId}
          totalCounters={counters.length}
          onShowList={() => setView('list')}
          onCounterUpdate={onCounterUpdate}
        />
      ) : (
        <CounterList
          counters={counters}
          activeId={activeId}
          onSelect={selectCounter}
          onAdd={addCounter}
          onDelete={removeCounter}
          onClose={() => setView('counter')}
        />
      )}
    </div>
  )
}
