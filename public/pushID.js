import {hashIsh} from './hashIsh.js';

/**
 * @fileoverview A universal JavaScript library to generate and decode unique, chronologically
 * sortable IDs (Push IDs), inspired by and compatible with Firebase's scheme.
 * This library is optimized for performance and provides a rich, extensible API.
 * It is dependency-free and works in any JavaScript environment (browsers, Node.js, Cloudflare Workers).
 *
 * @version 3.6.0
 */

/**
 * @typedef {object} PushIDOptions
 * @property {number|Date} [time] - A specific time to use for the timestamp part,
 * either as milliseconds since the UNIX epoch or a Date object. Defaults to `Date.now()`.
 * @property {string|null} [stub] - A string identifier for the ID's type (e.g., 'user', 'post').
 * If set to null or an empty string, a legacy (non-delimited) ID is created.
 * @property {number} [length=12] - The desired length for the random/hash part. Minimum is 12.
 * @property {string} [randomness] - A specific random string to use, bypassing
 * the internal random generator. This is useful for testing or specific use cases.
 * @property {*} [data] - Data to be hashed to create a deterministic "random" part.
 * Used by `newHashID`.
 */

/**
 * @typedef {object} PushIDObject
 * @property {string} id - The full pushID string (e.g., "0QZ7q0_-user-aBcDeFgHiJkL").
 * @property {string} randomness - The random part of the ID.
 * @property {Date} date - The timestamp of the ID's creation as a Date object.
 * @property {string|null} stub - The stub of the ID (e.g., "user"), or null if not present.
 */

/**
 * @typedef {object} DecodedPushIDObject
 * @property {string} id - The original pushID string that was decoded.
 * @property {string} randomness - The random part of the ID.
 * @property {Date} date - The creation timestamp of the ID as a Date object.
 * @property {string|null} stub - The stub part of the ID, or null for legacy IDs.
 * @property {string} encodedTime - The 8-character encoded timestamp part of the ID.
 */

/**
 * An IIFE (Immediately Invoked Function Expression) that encapsulates all library
 * logic, keeping internal state private and returning a public API object.
 * @returns {object} The public `pushID` object with all generation and decoding methods.
 */
export const pushID = (function () {
    /**
     * The 64-character set used for base-64 encoding of the ID. The order is
     * optimized for correct lexicographical sorting.
     * @type {string}
     */
    const PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~';

    /**
     * A reverse lookup map created on initialization for fast character-to-value
     * decoding. Maps each character in `PUSH_CHARS` to its integer index.
     * @type {Object<string, number>}
     */
    const CHARS_MAP = {};
    for (let i = 0; i < PUSH_CHARS.length; i++) CHARS_MAP[PUSH_CHARS[i]] = i;

    /**
     * Caches the complete object from the last ID generation.
     * @type {PushIDObject|null}
     */
    let lastIdObj = null;

    /**
     * A simple, fast xor128+ pseudo-random number generator.
     * @private
     * @returns {number} A random number between 0 and 1.
     */
    const prng = (function () {
        let seed = (Date.now() >>> 0) % 0xFFFFFFFF;
        return function () {
            seed = (seed * 1664525 + 1013904223) % 0xFFFFFFFF;
            return seed / 0xFFFFFFFF;
        }
    })();


    /**
     * The core private function for generating a new pushID object.
     * @private
     * @param {PushIDOptions} [options={}] - Configuration for the ID generation.
     * @returns {PushIDObject} The generated object containing the ID and its parts.
     */
    function _generateObject(options = {}) {
        const {time, stub = null, length = 12} = options;
        const randLength = Math.max(12, length);
        let now;
        if (time instanceof Date) now = time.getTime();
        else if (typeof time === 'number') now = time;
        else now = Date.now();

        // 1. Encode the timestamp
        const timeChars = new Array(8);
        let timestampNow = now;
        for (let i = 7; i >= 0; i--) {
            timeChars[i] = PUSH_CHARS.charAt(timestampNow % 64);
            timestampNow = Math.floor(timestampNow / 64);
        }

        // 2. Generate the random part
        let randStr;
        if (typeof options.randomness === 'string') {
            randStr = options.randomness;
        } else if (options.data !== undefined) {
            randStr = hashIsh(options.data, randLength, PUSH_CHARS);
        } else {
            randStr = publicApi.newRnd(randLength);
        }

        // 3. Assemble the ID
        const useDelimitedFormat = stub && typeof stub === 'string';
        const idParts = [timeChars.join('')];
        if (useDelimitedFormat) idParts.push(stub);
        idParts.push(randStr);

        const newObj = {
            id: idParts.join(useDelimitedFormat ? '-' : ''),
            randomness: randStr,
            date: new Date(now),
            stub: useDelimitedFormat ? stub : null
        };
        lastIdObj = newObj;
        return newObj;
    }

    /**
     * Decodes a pushID into its constituent parts.
     * @private
     * @param {string} id - The pushID string to decode.
     * @returns {DecodedPushIDObject|null} The decoded object, or null if the ID is invalid.
     */
    function _decodeObj(id) {
        if (typeof id !== 'string' || id.length === 0) return null;
        const parts = id.split('-');
        // New, delimited format: [Timestamp]-[Stub]-[Randomness]
        if (parts.length === 3) {
            const [timeStr, stub, randStr] = parts;
            const timestamp = _decodeTime(timeStr);
            if (timestamp === null) return null;
            return {id, randomness: randStr, date: new Date(timestamp), stub, encodedTime: timeStr};
        } else { // Legacy, non-delimited format
            if (id.length < 8) return null;
            const timeStr = id.substring(0, 8);
            const randStr = id.substring(8);
            const timestamp = _decodeTime(timeStr);
            if (timestamp === null) return null;
            return {id, randomness: randStr, date: new Date(timestamp), stub: null, encodedTime: timeStr};
        }
    }

    /**
     * Decodes an 8-character encoded timestamp string into milliseconds.
     * @private
     * @param {string} timeStr - The 8-character encoded time string.
     * @returns {number|null} The timestamp in milliseconds, or null if invalid.
     */
    function _decodeTime(timeStr) {
        let timestamp = 0;
        for (let i = 0; i < timeStr.length; i++) {
            const charValue = CHARS_MAP[timeStr[i]];
            if (charValue === undefined) return null; // Invalid character
            timestamp = timestamp * 64 + charValue;
        }
        return timestamp;
    }

    /**
     * The public API object returned by the IIFE.
     * @type {object}
     */
    const publicApi = {
        /**
         * Generates a new pushID string.
         * @param {PushIDOptions} [options] - Configuration for the ID.
         * @returns {string} The new pushID string.
         * @example
         * // Generate a standard ID (legacy format)
         * const id1 = pushID.newID({ stub: null });
         * // -> "0QZ7qAbkL9xZ~_bVn2m"
         *
         * // Generate an ID with a custom "user" stub
         * const id2 = pushID.newID({ stub: 'user' });
         * // -> "0QZ7qB1-user-bVn2mkL9xZ~_"
         *
         * // Generate an ID with a specific length
         * const id3 = pushID.newID({ stub: 'post', length: 16 });
         * // -> "0QZ7qC9-post-kL9xZ~_bVn2mkL9"
         */
        newID: (options) => _generateObject(options).id,

        /**
         * Generates a new pushID and returns it as a full object.
         * @param {PushIDOptions} [options] - Configuration for the ID.
         * @returns {PushIDObject} A new pushID object.
         * @example
         * const idObject = pushID.newObj({ stub: 'event' });
         * // -> {
         * //      id: "0QZ7qDq-event-bVn2mkL9xZ~_",
         * //      randomness: "bVn2mkL9xZ~_",
         * //      date: Date object,
         * //      stub: "event"
         * //    }
         */
        newObj: (options) => _generateObject(options),

        /**
         * Returns the previously generated ID string.
         * @returns {string|null} The last ID generated, or null if none.
         */
        previousID: () => lastIdObj ? lastIdObj.id : null,

        /**
         * Returns the previously generated ID object.
         * @returns {PushIDObject|null} The last object generated.
         */
        previousObj: () => lastIdObj,

        /**
         * Generates a new pushID where the random part is a hash of the provided data.
         * This is useful for creating deterministic, idempotent IDs.
         * @param {PushIDOptions} options - Configuration object. Must include a `data` property.
         * @returns {string} A new, deterministically generated pushID.
         * @example
         * const userData = { userId: 123, email: "test@example.com" };
         * const hashedId = pushID.newHashID({ data: userData, stub: 'session' });
         * // -> "0QZ7qGg-session-v3G4bQdG~Qc5" (will be the same every time for the same data)
         */
        newHashID: (options = {}) => publicApi.newID(options),

        /**
         * Decodes a pushID into a full object containing its parts. Returns null on error.
         * @param {string} id - The pushID to decode.
         * @returns {DecodedPushIDObject|null} The decoded object, or null if invalid.
         */
        decodeID: (id) => _decodeObj(id),

        /**
         * Decodes a pushID within a try-catch block, ensuring it never throws.
         * @param {string} id - The pushID to decode.
         * @returns {DecodedPushIDObject|null} The decoded object, or null if an error occurs.
         * @example
         * const decoded = pushID.tryDecodeID("0QZ7qB1-user-bVn2mkL9xZ~_");
         * if (decoded) {
         * console.log(decoded.date.getFullYear()); // 2025
         * console.log(decoded.stub); // "user"
         * }
         */
        tryDecodeID: (id) => {
            try {
                return _decodeObj(id);
            } catch (e) {
                return null;
            }
        },

        /**
         * Decodes a pushID and returns its creation time in milliseconds since the UNIX epoch.
         * @param {string} id - The pushID to decode.
         * @returns {number|null} The timestamp in milliseconds, or null if invalid.
         */
        decodeTime: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.date.getTime() : null;
        },

        /**
         * Decodes a pushID and returns its creation time as a Date object.
         * @param {string} id - The pushID to decode.
         * @returns {Date|null} The creation date of the ID, or null if invalid.
         */
        decodeDate: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.date : null;
        },

        /**
         * Generates a random string of a specified length using the pushID character set.
         * @param {number} [length=12] - The desired length of the random string. Minimum is 12.
         * @returns {string} A random string.
         */
        newRnd: (length = 12) => {
            const len = Math.max(12, length);
            const chars = new Array(len);
            for (let i = 0; i < len; i++) {
                chars[i] = PUSH_CHARS.charAt(Math.floor(prng() * 64));
            }
            return chars.join('');
        },

        /**
         * Creates a stable, deterministic hash string from any JavaScript input.
         * @param {*} input - The value to hash (object, array, string, etc.).
         * @param {number} [length=12] - The desired length of the hash. Minimum is 12.
         * @returns {string} A stable hash string.
         * @example
         * const data = { b: 2, a: 1 }; // Order doesn't matter
         * const h = pushID.hash(data);
         * // -> "Qc5~v3G4bQdG"
         */
        hash: (input, length = 12) => {
            const len = Math.max(12, length);
            return hashIsh(input, len, PUSH_CHARS);
        },
    };

    // --- Convenience Aliases ---
    publicApi.next = publicApi.newID;
    publicApi.nextID = publicApi.newID;
    publicApi.nextObj = publicApi.newObj;
    publicApi.previous = publicApi.previousID;
    publicApi.prevObj = publicApi.previousObj;
    publicApi.nextHashID = publicApi.newHashID;

    return publicApi;
})();