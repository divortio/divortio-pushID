/**
 * @fileoverview
 * A universal JavaScript library to generate and decode unique, chronologically
 * sortable IDs (Push IDs), inspired by and compatible with Firebase's scheme.
 * This library is optimized for performance and provides a rich, extensible API.
 *
 * @version 3.5.0
 */

/**
 * An IIFE (Immediately Invoked Function Expression) that encapsulates all library
 * logic, keeping internal state private and returning a public API object.
 * @returns {object} The public `pushID` object with all generation and decoding methods.
 */
const pushID = (function () {
    /**
     * @type {string}
     * The 64-character set used for base-64 encoding of the ID. The order is
     * optimized for correct lexicographical sorting.
     */
    const PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~';

    /**
     * @type {Object<string, number>}
     * A reverse lookup map created on initialization for fast character-to-value
     * decoding. Maps each character in `PUSH_CHARS` to its integer index.
     */
    const CHARS_MAP = {};
    for (let i = 0; i < PUSH_CHARS.length; i++) {
        CHARS_MAP[PUSH_CHARS[i]] = i;
    }

    /**
     * @type {object|null}
     * Caches the complete object from the last ID generation, accessible via
     * `previousObj()` and `previousID()`.
     */
    let lastIdObj = null;

    /**
     * The core private function for generating a new pushID object. All public
     * generation methods are wrappers around this function.
     * @private
     * @param {object} [options={}] - Configuration for the ID generation.
     * @param {number|Date} [options.time] - A specific time to use for the timestamp part,
     * either as milliseconds since epoch or a Date object. Defaults to `Date.now()`.
     * @param {string|null} [options.stub='pshID'] - A string identifier for the ID's type.
     * If set to null or an empty string, a legacy (non-delimited) ID is created.
     * @param {number} [options.length=12] - The desired length for the random/hash part.
     * Minimum is 12.
     * @param {string} [options.randomness] - A specific random string to use, bypassing
     * the internal random generator.
     * @param {*} [options.data] - Data to be hashed to create a deterministic "random" part.
     * @returns {{id: string, randomness: string, date: Date, stub: string|null}} The generated object.
     */
    function _generateObject(options = {}) {
        // --- 1. Resolve Options ---
        const {time, stub = 'pshID', length = 12} = options;
        const randLength = Math.max(12, length);

        // Determine the timestamp, defaulting to the current time.
        let now;
        if (time instanceof Date) now = time.getTime();
        else if (typeof time === 'number') now = time;
        else now = Date.now();

        // --- 2. Generate Timestamp Part ---
        const timeChars = new Array(8);
        let timestampNow = now;
        for (let i = 7; i >= 0; i--) {
            timeChars[i] = PUSH_CHARS.charAt(timestampNow % 64);
            timestampNow = Math.floor(timestampNow / 64);
        }
        const timeStr = timeChars.join('');

        // --- 3. Generate Randomness Part ---
        let randStr;
        if (typeof options.randomness === 'string') {
            // Use user-provided randomness.
            randStr = options.randomness;
        } else if (options.data !== undefined) {
            // Generate randomness by hashing data.
            randStr = publicApi.hash(options.data, randLength);
        } else {
            // Generate new random characters.
            randStr = publicApi.newRnd(randLength);
        }

        // --- 4. Assemble Final Object ---
        // Determine if we should use the new delimited format or the legacy format.
        const useDelimitedFormat = stub && typeof stub === 'string';

        const newObj = {
            id: useDelimitedFormat ? `${timeStr}-${stub}-${randStr}` : `${timeStr}${randStr}`,
            randomness: randStr,
            date: new Date(now),
            stub: useDelimitedFormat ? stub : null
        };

        // Cache this result for `previous()` calls.
        lastIdObj = newObj;
        return newObj;
    }

    /**
     * Deterministically serializes any JavaScript value for hashing.
     * Ensures that object keys are sorted to produce a stable, consistent output.
     * @private
     * @param {*} val - The value to serialize (string, number, object, array, etc.).
     * @returns {string} A stable, stringified representation of the value.
     */
    function _serialize(val) {
        if (val === null || val === undefined) return 'null';
        if (typeof val !== 'object') return JSON.stringify(val);
        if (Array.isArray(val)) return '[' + val.map(_serialize).join(',') + ']';

        // For objects, sort keys before serializing to ensure a consistent hash.
        return '{' + Object.keys(val).sort().map(key =>
            JSON.stringify(key) + ':' + _serialize(val[key])
        ).join(',') + '}';
    }

    /**
     * Decodes a pushID into its constituent parts. This is the core private
     * decoding function used by all public decode methods. It is backward-compatible
     * and can parse both new (delimited) and old (legacy) ID formats.
     * @private
     * @param {string} id - The pushID string to decode.
     * @returns {{id: string, randomness: string, date: Date, stub: string|null, encodedTime: string}} The decoded object.
     */
    function decodeObj(id) {
        if (typeof id !== 'string' || id.length === 0) {
            throw new TypeError('Invalid Push ID provided. Must be a non-empty string.');
        }

        const parts = id.split('-');

        if (parts.length === 3) {
            // New format: [Timestamp]-[Stub]-[Randomness]
            const [timeStr, stub, randStr] = parts;
            const timestamp = decodeTime(timeStr);
            return {id, randomness: randStr, date: new Date(timestamp), stub, encodedTime: timeStr};
        } else {
            // Legacy format: [Timestamp][Randomness]
            if (id.length < 8) throw new Error('Invalid legacy Push ID format.');
            const timeStr = id.substring(0, 8);
            const randStr = id.substring(8);
            const timestamp = decodeTime(timeStr);
            return {id, randomness: randStr, date: new Date(timestamp), stub: null, encodedTime: timeStr};
        }
    }

    /**
     * Decodes an 8-character encoded timestamp string into milliseconds.
     * @private
     * @param {string} timeStr - The 8-character encoded time string.
     * @returns {number} The timestamp in milliseconds since the UNIX epoch.
     */
    function decodeTime(timeStr) {
        let timestamp = 0;
        for (let i = 0; i < timeStr.length; i++) {
            const charValue = CHARS_MAP[timeStr[i]];
            if (charValue === undefined) throw new Error('Invalid Push ID character: ' + timeStr[i]);
            // Reconstruct the timestamp from base-64.
            timestamp = timestamp * 64 + charValue;
        }
        return timestamp;
    }

    /**
     * @type {object}
     * The public API object that will be returned by the IIFE.
     */
    const publicApi = {
        /**
         * Generates a new pushID string.
         * @param {object} [options] - Configuration object passed to `_generateObject`.
         * @returns {string} A new pushID.
         */
        newID: (options) => _generateObject(options).id,

        /**
         * Generates a new pushID and returns it as a full object.
         * @param {object} [options] - Configuration object passed to `_generateObject`.
         * @returns {{id: string, randomness: string, date: Date, stub: string|null}} A new pushID object.
         */
        newObj: (options) => _generateObject(options),

        /**
         * Generates a new pushID where the random part is a hash of the provided data.
         * @param {object} [options] - Configuration object. Must include a `data` property.
         * @returns {string} A new, deterministically generated pushID.
         */
        newHashID: (options = {}) => publicApi.newID(options),

        /**
         * Returns the previously generated ID string.
         * @returns {string|null} The last ID generated, or null if none.
         */
        previousID: () => lastIdObj ? lastIdObj.id : null,

        /**
         * Returns the previously generated ID object.
         * @returns {{id: string, randomness: string, date: Date, stub: string|null}|null} The last object generated.
         */
        previousObj: () => lastIdObj,

        /**
         * Returns the current time in milliseconds since the UNIX epoch.
         * @returns {number} The current timestamp.
         */
        newTime: () => Date.now(),

        /**
         * Returns the current time as a JavaScript Date object.
         * @returns {Date} The current Date.
         */
        newDate: () => new Date(),

        /**
         * Generates a random string of a specified length using the pushID character set.
         * @param {number} [length=12] - The desired length of the random string. Minimum is 12.
         * @returns {string} A random string.
         */
        newRnd: (length = 12) => {
            const len = Math.max(12, length);
            const chars = new Array(len);
            for (let i = 0; i < len; i++) {
                chars[i] = PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
            }
            return chars.join('');
        },

        /**
         * Creates a stable, deterministic hash string from any JavaScript input.
         * @param {*} input - The value to hash (object, array, string, etc.).
         * @param {number} [length=12] - The desired length of the hash. Minimum is 12.
         * @returns {string} A stable hash string.
         */
        hash: (input, length = 12) => {
            const len = Math.max(12, length);
            const serialized = _serialize(input);

            // A simple, dependency-free MurmurHash3-like implementation for string hashing.
            let h1 = 1779033703, h2 = 3144134277,
                h3 = 1013904242, h4 = 2773480762;

            for (let i = 0, k; i < serialized.length; i++) {
                k = serialized.charCodeAt(i);
                h1 = h2 ^ Math.imul(h1, 597399067);
                h2 = h3 ^ Math.imul(h2, 2869860233);
                h3 = h4 ^ Math.imul(h3, 951274213);
                h4 = h1 ^ Math.imul(h4, 2716044179);
                h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
                h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
                h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507);
                h4 = Math.imul(h4 ^ (h4 >>> 13), 3266489909);
                h1 = (h1 ^ k) >>> 0;
            }

            const hashChars = new Array(len);
            for (let i = 0; i < len; i++) {
                const state = [h1, h2, h3, h4];
                // Use the hash state to select characters from PUSH_CHARS.
                const charIndex = (state[i % 4] >> ((i % 5) * 3)) & 63;
                hashChars[i] = PUSH_CHARS.charAt(charIndex);
            }
            return hashChars.join('');
        },

        /**
         * Decodes a pushID into a full object containing its parts.
         * @param {string} id - The pushID to decode.
         * @returns {{id: string, randomness: string, date: Date, stub: string|null, encodedTime: string}} The decoded object.
         */
        decodeID: (id) => decodeObj(id),

        /**
         * Decodes a pushID and returns its creation time in milliseconds.
         * @param {string} id - The pushID to decode.
         * @returns {number} The timestamp in milliseconds.
         */
        decodeTime: (id) => decodeObj(id).date.getTime(),

        /**
         * Decodes a pushID and returns its creation time as a Date object.
         * @param {string} id - The pushID to decode.
         * @returns {Date} The creation date of the ID.
         */
        decodeDate: (id) => decodeObj(id).date,

        /**
         * Decodes a pushID and returns its random part.
         * @param {string} id - The pushID to decode.
         * @returns {string} The randomness string.
         */
        decodeStr: (id) => decodeObj(id).randomness,

        /**
         * Decodes a pushID and returns its stub.
         * @param {string} id - The pushID to decode.
         * @returns {string|null} The stub, or null for legacy IDs.
         */
        decodeStub: (id) => decodeObj(id).stub,
    };

    // --- Convenience aliases for the public API ---
    publicApi.next = publicApi.newID;
    publicApi.nextID = publicApi.newID;
    publicApi.nextObj = publicApi.newObj;
    publicApi.previous = publicApi.previousID;
    publicApi.prevObj = publicApi.previousObj;
    publicApi.nextHashID = publicApi.newHashID;
    publicApi.prevHashID = publicApi.previousID;

    return publicApi;
})();


/**
 * ===================================================================
 * sessionManager Library (v4.4.0 with API improvements)
 * ===================================================================
 */
const sessionManager = (config = {}) => {
    const finalConfig = {
        sessionTimeout: 30 * 60 * 1000, randomnessLength: 12, cookiePrefix: '__psh_',
        cookieOptions: {path: '/', secure: false, sameSite: 'Lax'}, ...config,
    };

    const storageHandler = {
        _isCookieEnabled: null,
        _checkCookieEnabled() {
            if (this._isCookieEnabled !== null) return this._isCookieEnabled;
            try {
                document.cookie = "testcookie=1; SameSite=Lax";
                const enabled = document.cookie.indexOf("testcookie") !== -1;
                document.cookie = "testcookie=1; expires=Thu, 01-Jan-1970 00:00:01 GMT; SameSite=Lax";
                this._isCookieEnabled = enabled;
                return enabled;
            } catch (e) {
                this._isCookieEnabled = false;
                return false;
            }
        },
        get(key) {
            const name = finalConfig.cookiePrefix + key;
            if (this._checkCookieEnabled()) {
                const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'));
                return match ? decodeURIComponent(match[2]) : null;
            } else if (typeof localStorage !== 'undefined') {
                const item = localStorage.getItem(name);
                if (!item) return null;
                try {
                    const {value, expires} = JSON.parse(item);
                    if (expires && Date.now() > expires) {
                        localStorage.removeItem(name);
                        return null;
                    }
                    return value;
                } catch (e) {
                    return null;
                }
            }
            return null;
        },
        set(key, value, cookieOpts) {
            const name = finalConfig.cookiePrefix + key;
            if (this._checkCookieEnabled()) {
                let cookieString = `${name}=${encodeURIComponent(value)}`;
                for (const optKey in cookieOpts) {
                    const optValue = cookieOpts[optKey];
                    if (optValue instanceof Date) cookieString += `; ${optKey}=${optValue.toUTCString()}`;
                    else cookieString += `; ${optKey}=${optValue}`;
                }
                document.cookie = cookieString;
            } else if (typeof localStorage !== 'undefined') {
                const expires = cookieOpts.expires ? new Date(cookieOpts.expires).getTime() : null;
                localStorage.setItem(name, JSON.stringify({value, expires}));
            }
        },
        clear() {
            const keys = ['cID', 'sID', 'eID'];
            keys.forEach(key => {
                const name = finalConfig.cookiePrefix + key;
                if (this._checkCookieEnabled()) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                }
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(name);
                }
            });
        }
    };

    const process = (options = {}) => {
        const cID = storageHandler.get('cID');
        const sID = storageHandler.get('sID');
        const prevEID = storageHandler.get('eID');

        const oldState = {
            cID: cID, sID: sID, eID: prevEID,
            clientTime: cID ? new Date(pushID.decodeTime(cID)) : null,
            sessionTime: sID ? new Date(pushID.decodeTime(sID)) : null,
            eventTime: prevEID ? new Date(pushID.decodeTime(prevEID)) : null
        };

        let isSessionExpired = true;
        const lastActivityID = prevEID || sID || cID;
        if (lastActivityID) {
            try {
                const lastActivityTime = pushID.decodeTime(lastActivityID);
                isSessionExpired = (Date.now() - lastActivityTime) > finalConfig.sessionTimeout;
            } catch (e) {
                isSessionExpired = true;
            }
        }

        const idOptions = {length: finalConfig.randomnessLength};
        const newEID = pushID.newID({...idOptions, stub: 'eID'});

        const finalCID = cID || pushID.newID({...idOptions, stub: 'cID'});
        const finalSID = (!sID || isSessionExpired) ? pushID.newID({...idOptions, stub: 'sID'}) : sID;

        const newState = {
            cID: finalCID, sID: finalSID, eID: newEID,
            clientTime: new Date(pushID.decodeTime(finalCID)),
            sessionTime: new Date(pushID.decodeTime(finalSID)),
            eventTime: new Date(pushID.decodeTime(newEID))
        };

        const changes = {
            isNewClient: !cID,
            isNewSession: !sID || isSessionExpired
        };

        const cIDExpiry = new Date();
        cIDExpiry.setFullYear(cIDExpiry.getFullYear() + 2);
        storageHandler.set('cID', newState.cID, {...finalConfig.cookieOptions, expires: cIDExpiry});
        const sessionExpiry = new Date(Date.now() + finalConfig.sessionTimeout);
        const sessionCookieOptions = {...finalConfig.cookieOptions, expires: sessionExpiry};
        storageHandler.set('sID', newState.sID, sessionCookieOptions);
        storageHandler.set('eID', newState.eID, sessionCookieOptions);

        return {...newState, newState, oldState, changes};
    };

    return {process, clear: storageHandler.clear.bind(storageHandler), storageHandler, config: finalConfig};
};