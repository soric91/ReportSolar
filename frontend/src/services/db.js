import { openDB } from 'idb'

const DB_NAME = 'solar-maintenance-pwa'
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('proyectos')) {
      db.createObjectStore('proyectos', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('visitas')) {
      const visitasStore = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true })
      visitasStore.createIndex('proyecto_id', 'proyecto_id')
      visitasStore.createIndex('estado', 'estado')
    }
    if (!db.objectStoreNames.contains('fotos')) {
      const fotosStore = db.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true })
      fotosStore.createIndex('visita_id', 'visita_id')
    }
  },
})

export const db = {
  async saveProyectos(proyectos) {
    const database = await dbPromise
    const tx = database.transaction('proyectos', 'readwrite')
    for (const p of proyectos) {
      await tx.store.put(p)
    }
    await tx.done
  },

  async getProyectos() {
    const database = await dbPromise
    return database.getAll('proyectos')
  },

  async getProyecto(id) {
    const database = await dbPromise
    return database.get('proyectos', id)
  },

  async saveVisita(visita) {
    const database = await dbPromise
    const id = await database.add('visitas', { ...visita, created_at: new Date().toISOString() })
    return id
  },

  async getVisitas() {
    const database = await dbPromise
    return database.getAll('visitas')
  },

  async getVisita(id) {
    const database = await dbPromise
    return database.get('visitas', id)
  },

  async updateVisita(visita) {
    const database = await dbPromise
    await database.put('visitas', visita)
  },

  async getVisitasByProyecto(proyectoId) {
    const database = await dbPromise
    const index = database.transaction('visitas').store.index('proyecto_id')
    return index.getAll(proyectoId)
  },

  async deleteVisita(id) {
    const database = await dbPromise
    await database.delete('visitas', id)
  },

  async saveFoto(foto) {
    const database = await dbPromise
    const id = await database.add('fotos', { ...foto, created_at: new Date().toISOString() })
    return id
  },

  async getFotosByVisita(visitaId) {
    const database = await dbPromise
    const index = database.transaction('fotos').store.index('visita_id')
    return index.getAll(visitaId)
  },

  async deleteFoto(id) {
    const database = await dbPromise
    await database.delete('fotos', id)
  },

  async getAllFotos() {
    const database = await dbPromise
    return database.getAll('fotos')
  },

  async clearAll() {
    const database = await dbPromise
    await database.clear('proyectos')
    await database.clear('visitas')
    await database.clear('fotos')
  },
}
