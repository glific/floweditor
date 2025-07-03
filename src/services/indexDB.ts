import { Middleware } from 'redux';
import { getCurrentDefinition } from '../store/helpers';

const DB_NAME = 'FlowDefinitionDB';
const VERSION = 1;
const STORE_NAME = 'flowDefinitions';

let dbInstance: IDBDatabase | null = null;
let saveTimeout: NodeJS.Timeout | null;
let lastSaveTime = 0;
const SAVE_INTERVAL = 2000;

// Initialize and open the database
async function initDB(): Promise<IDBDatabase> {
  console.log('Initializing IndexedDB...');
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      console.log('IndexedDB Initialised...');

      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
        store.createIndex('timestamp', 'timeStamp', { unique: false });
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
      timeStamp: new Date().toISOString()
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
    if (now - lastSaveTime > SAVE_INTERVAL) {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        const newDefinition = getCurrentDefinition(definition, nodes, true);
        await saveFlowDefinition(definition.uuid, newDefinition);
        lastSaveTime = Date.now();
      }, 500);
    }
  }
};

export default storeChangeMiddleware;
