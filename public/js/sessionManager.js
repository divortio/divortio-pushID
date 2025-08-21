import {pushID} from './pushID.js';

/**
 * @fileoverview A universal (isomorphic) JavaScript library for robustly managing a hierarchy of client, session, and event identifiers.
 * @version 5.0.0
 *
 * This library is designed to be storage-agnostic. It provides the core logic for session management
 * and delegates the actual storage (getting/setting IDs) to a `storageHandler` that you provide.
 * This makes it suitable for both client-side (using cookies/localStorage) and server-side
 * (e.g., Cloudflare Workers, Node.js with response headers) environments.
 *
 * It manages a "waterfall" of identifiers:
 * - cID (Client ID): A long-term identifier for a unique browser/client.
 * - sID (Session ID): Rotates after a configurable period of inactivity.
 * - eID (Event ID): A new ID generated for every tracked event, acting as a "heartbeat".
 * - seqID (Sequence ID): Tracks the session number and the event number within that session.
 */

/**
 * @typedef {object} PushIDObject
 * @property {string} id - The full pushID string (e.g., "0QZ7q0_-user-aBcDeFgHiJkL").
 * @property {string} randomness - The random part of the ID.
 * @property {Date} date - The timestamp of the ID's creation as a Date object.
 * @property {string|null} stub - The stub of the ID (e.g., "user"), or null if not present.
 * @property {string} encodedTime - The 8-character encoded timestamp part of the ID.
 */

/**
 * @typedef {object} SessionState
 * @property {string|null} cID - The Client ID.
 * @property {string|null} sID - The Session ID.
 * @property {string|null} eID - The Event ID from the previous event.
 * @property {string|null} seqID - The Sequence ID (e.g., "1-1").
 * @property {Date|null} clientTime - The timestamp of the cID as a Date object.
 * @property {Date|null} sessionTime - The timestamp of the sID as a Date object.
 * @property {Date|null} eventTime - The timestamp of the eID as a Date object.
 */

/**
 * @typedef {object} SessionChanges
 * @property {boolean} isNewClient - True if a new cID was generated.
 * @property {boolean} isNewSession - True if a new sID was generated.
 */

/**
 * @typedef {object} ProcessedSession
 * @property {string} cID - The current Client ID.
 * @property {string} sID - The current Session ID.
 * @property {string} eID - The newly generated Event ID for the current event.
 * @property {string} seqID - The newly generated Sequence ID.
 * @property {Date} clientTime - The timestamp of the cID.
 * @property {Date} sessionTime - The timestamp of the sID.
 * @property {Date} eventTime - The timestamp of the eID.
 * @property {SessionState} newState - An object representing the current state of all IDs and times.
 * @property {SessionState} oldState - An object representing the state before this event was processed.
 * @property {SessionChanges} changes - A summary of what changed during processing.
 */

/**
 * @typedef {object} StorageHandler
 * @property {function(string): (string|null)} get - Retrieves a value from storage by key.
 * @property {function(string, string, object): void} set - Saves a value to storage by key, with options.
 * @property {function(): void} clear - Clears all session-related keys from storage.
 * @property {object} config - The configuration of the storage handler.
 */

/**
 * @typedef {object} SessionManagerConfig
 * @property {number} [sessionTimeout=1800000] - The session inactivity timeout in milliseconds. Defaults to 30 minutes.
 * @property {number} [randomnessLength=12] - The length of the random part of the generated pushIDs.
 * @property {boolean} [useStubs=false] - If true, adds stubs ('cID', 'sID', 'eID') to the generated IDs.
 */

/**
 * Factory function to create a new sessionManager instance.
 *
 * @param {SessionManagerConfig} [config={}] - Configuration for the session manager.
 * @returns {{process: function(options: {storageHandler: StorageHandler}): ProcessedSession, config: SessionManagerConfig}} A session manager instance.
 *
 * @example
 * // Basic Initialization
 * const manager = sessionManager({
 * sessionTimeout: 30 * 60 * 1000, // 30 minutes
 * useStubs: true
 * });
 */
export const sessionManager = (config = {}) => {

    const finalConfig = {
        sessionTimeout: 30 * 60 * 1000,
        randomnessLength: 12,
        useStubs: false,
        ...config,
    };

    /**
     * Processes a session event. It reads the previous state from the provided storageHandler,
     * generates new IDs based on the session logic (checking for timeouts), and writes the
     * new state back to the storageHandler.
     *
     * @param {object} options - The options for processing.
     * @param {StorageHandler} options.storageHandler - The storage handler instance to use for getting and setting session data.
     * @returns {ProcessedSession} A comprehensive object detailing the session state before and after the event.
     * @throws {Error} If a storageHandler is not provided.
     *
     * @example
     * // On the client-side with a clientStorage handler
     * const manager = sessionManager();
     * const storage = clientStorage(); // Assuming clientStorage is defined elsewhere
     *
     * const sessionData = manager.process({ storageHandler: storage });
     * console.log(sessionData.changes.isNewSession); // true or false
     * console.log(`Current session ID is ${sessionData.sID}`);
     */
    const process = (options = {}) => {
        const {storageHandler} = options;
        if (!storageHandler) {
            throw new Error("A storageHandler must be provided in the options.");
        }

        // 1. Read the old state from storage
        const cID = storageHandler.get('cID');
        const sID = storageHandler.get('sID');
        const prevEID = storageHandler.get('eID');
        const seqID = storageHandler.get('seqID');

        const cIDTime = cID ? pushID.decodeTime(cID) : null;
        const sIDTime = sID ? pushID.decodeTime(sID) : null;
        const prevEIDTime = prevEID ? pushID.decodeTime(prevEID) : null;

        const oldState = {
            cID, sID, eID: prevEID, seqID,
            clientTime: cIDTime ? new Date(cIDTime) : null,
            sessionTime: sIDTime ? new Date(sIDTime) : null,
            eventTime: prevEIDTime ? new Date(prevEIDTime) : null
        };

        // 2. Check if the session has expired
        let isSessionExpired = true;
        const lastActivityTime = prevEIDTime || sIDTime || cIDTime;
        if (lastActivityTime) {
            isSessionExpired = (Date.now() - lastActivityTime) > finalConfig.sessionTimeout;
        }

        // 3. Determine if new IDs are needed
        const idOptions = {length: finalConfig.randomnessLength};
        const isNewClient = !cID;
        const isNewSession = !sID || isSessionExpired;

        // 4. Generate new IDs
        const newEIDObj = pushID.newObj({...idOptions, stub: finalConfig.useStubs ? 'eID' : null});

        const finalCID = cID || (finalConfig.useStubs ? pushID.newID({...idOptions, stub: 'cID'}) : newEIDObj.id);
        const finalSID = isNewSession ? (finalConfig.useStubs ? pushID.newID({
            ...idOptions,
            stub: 'sID'
        }) : newEIDObj.id) : sID;

        // 5. Calculate the new sequence ID
        let sessionNum = 1;
        let sessionEventNum = 1;
        if (seqID && !isNewSession) {
            const parts = seqID.split('-').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                sessionNum = parts[0];
                sessionEventNum = parts[1] + 1;
            }
        } else if (seqID && isNewSession) {
            const parts = seqID.split('-').map(Number);
            if (parts.length === 2 && !isNaN(parts[0])) {
                sessionNum = parts[0] + 1;
            }
        }
        const finalSeqID = `${sessionNum}-${sessionEventNum}`;

        // 6. Construct the new state
        const newState = {
            cID: finalCID, sID: finalSID, eID: newEIDObj.id, seqID: finalSeqID,
            clientTime: new Date(pushID.decodeTime(finalCID)),
            sessionTime: new Date(pushID.decodeTime(finalSID)),
            eventTime: newEIDObj.date
        };

        const changes = {isNewClient, isNewSession};

        // 7. Persist the new state using the storage handler
        const cIDExpiry = new Date();
        cIDExpiry.setFullYear(cIDExpiry.getFullYear() + 2);
        storageHandler.set('cID', newState.cID, {...storageHandler.config.cookieOptions, expires: cIDExpiry});

        const sessionExpiry = new Date(Date.now() + finalConfig.sessionTimeout);
        const sessionCookieOptions = {...storageHandler.config.cookieOptions, expires: sessionExpiry};
        storageHandler.set('sID', newState.sID, sessionCookieOptions);
        storageHandler.set('eID', newState.eID, sessionCookieOptions);
        storageHandler.set('seqID', newState.seqID, sessionCookieOptions);

        // 8. Return the comprehensive result object
        return {...newState, newState, oldState, changes};
    };

    return {process, config: finalConfig};
};