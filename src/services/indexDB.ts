import { Middleware } from 'redux';
import { getCurrentDefinition } from '../store/helpers';

const DB_NAME = 'FlowDefinitionDB';
const VERSION = 1;
const STORE_NAME = 'flowDefinitions';

let dbInstance: IDBDatabase | null = null;
let saveTimeout: NodeJS.Timeout | null;
let lastSaveTime = 0;
const SAVE_INTERVAL = 2000;
const DEBOUNCE_DELAY = 500;

// Initialize and open the database
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
      }
    };
  });
}

async function saveFlowDefinition(uuid: string, definition: any): Promise<void> {
  const db = dbInstance || (await initDB());

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const flowData = {
      uuid: uuid,
      definition: definition,
      timestamp: new Date().toISOString()
    };

    const request = store.put(flowData);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to save flow definition'));
    };
  });
}

const storeChangeMiddleware: Middleware = store => next => (action: any) => {
  const result = next(action);
  const currentState = store.getState();

  middlewareFunction(currentState);

  return result;
};

const middlewareFunction = async (currentState: any) => {
  const { definition, nodes } = currentState.flowContext;

  if (definition && nodes) {
    const now = Date.now();
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      const saveTime = Date.now();
      if (saveTime - lastSaveTime >= SAVE_INTERVAL) {
        try {
          const newDefinition = getCurrentDefinition(definition, nodes, true);
          await saveFlowDefinition(definition.uuid, newDefinition);
          lastSaveTime = saveTime;
        } catch (error) {
          console.error('Error saving flow definition:', error);
        }
      }
      saveTimeout = null;
    }, DEBOUNCE_DELAY);
  }
};

export default storeChangeMiddleware;
