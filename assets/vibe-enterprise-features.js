/**
 * VIBE Enterprise Features (Phase 1-4 Completer)
 * Includes: 
 * 1. E-Signature Cryptographic Hashing
 * 2. Offline Sync (IndexedDB wrapper)
 * 3. IoT Edge Stream Simulation for AutoMFG
 */

// ==========================================
// Phase 4: E-Signature Cryptographic Hashing
// ==========================================
async function generateESignature(userId, documentId, role) {
    const encoder = new TextEncoder();
    const timestamp = new Date().toISOString();
    const payload = `${userId}:${documentId}:${role}:${timestamp}`;
    const data = encoder.encode(payload);
    
    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
        signatureHash: hashHex,
        timestamp: timestamp,
        payloadStr: payload
    };
}

// ==========================================
// Phase 2: Offline Synchronization (IndexedDB)
// ==========================================
class OfflineSyncService {
    constructor(dbName = 'VibeEnterpriseSync') {
        this.dbName = dbName;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (e) => reject(e);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async queueTransaction(table, payload) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.add({
                table,
                payload,
                queuedAt: new Date().toISOString(),
                status: 'pending'
            });
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e);
        });
    }

    async getQueue() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }
}

// ==========================================
// Phase 1: IoT Edge Stream Simulator (AutoMFG)
// ==========================================
class IoTStreamSimulator {
    constructor(callback) {
        this.listeners = [];
        this.interval = null;
        if (callback) this.subscribe(callback);
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => {
            const mockEvents = [
                { station: 'Weld-1', metric: 'Takt Time', value: (Math.random() * 5 + 40).toFixed(1) + 's', status: 'Optimal' },
                { station: 'Paint-2', metric: 'Temperature', value: (Math.random() * 2 + 70).toFixed(1) + 'C', status: 'Warning' },
                { station: 'Assy-4', metric: 'Torque', value: (Math.random() * 1 + 14).toFixed(1) + 'Nm', status: 'Optimal' }
            ];
            
            // Randomly trigger Andon event (5% chance)
            if (Math.random() > 0.95) {
                mockEvents.push({ station: 'Stamping-1', metric: 'Jam', value: 'ERR', status: 'Critical - ANDON' });
            }

            this.listeners.forEach(cb => cb(mockEvents));
        }, 3000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

window.VibeEnterprise = {
    generateESignature,
    OfflineSyncService,
    IoTStreamSimulator
};
