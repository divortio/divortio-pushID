import {hashIsh} from './hashIsh.js';

/**
 * @fileoverview
 * A universal JavaScript library to generate and decode unique, chronologically
 * sortable IDs (Push IDs), inspired by and compatible with Firebase's scheme.
 * This library is optimized for performance and provides a rich, extensible API.
 *
 * @version 3.6.0
 */

/**
 * An IIFE (Immediately Invoked Function Expression) that encapsulates all library
 * logic, keeping internal state private and returning a public API object.
 * @returns {object} The public `pushID` object with all generation and decoding methods.
 */
export const pushID = (function () {
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
    for (let i = 0; i < PUSH_CHARS.length; i++) CHARS_MAP[PUSH_CHARS[i]] = i;
    /**
     * @type {object|null}
     * Caches the complete object from the last ID generation, accessible via
     * `previousObj()` and `previousID()`.
     */
    let lastIdObj = null;
    /**
     * xor128+ Random Number Generator
     * example: prng() // 0.11172363956266168
     * @private
     * @returns {number} Random number. Ex: 0.11172363956266168
     */
    const prng = (function () {
        let seed = (Date.now() >>> 0) % 0xFFFFFFFF;
        return function () {
            seed = (seed * 1664525 + 1013904223) % 0xFFFFFFFF;
            return seed / 0xFFFFFFFF;
        }
    })();


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
        const {time, stub = null, length = 12} = options;
        const randLength = Math.max(12, length);
        let now;
        if (time instanceof Date) now = time.getTime();
        else if (typeof time === 'number') now = time;
        else now = Date.now();

        const timeChars = new Array(8);
        let timestampNow = now;
        for (let i = 7; i >= 0; i--) {
            timeChars[i] = PUSH_CHARS.charAt(timestampNow % 64);
            timestampNow = Math.floor(timestampNow / 64);
        }

        let randStr;
        if (typeof options.randomness === 'string') randStr = options.randomness;
        else if (options.data !== undefined) randStr = hashIsh(options.data, randLength, PUSH_CHARS);
        else randStr = publicApi.newRnd(randLength);

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
     * Decodes a pushID into its constituent parts. This is the core private
     * decoding function used by all public decode methods. It is backward-compatible
     * and can parse both new (delimited) and old (legacy) ID formats.
     * @private
     * @param {string} id - The pushID string to decode.
     * @returns {{id: string, randomness: string, date: Date, stub: string|null, encodedTime: string}} The decoded object.
     */
    function decodeObj(id) {
        if (typeof id !== 'string' || id.length === 0) return null;
        const parts = id.split('-');
        if (parts.length === 3) {
            const [timeStr, stub, randStr] = parts;
            const timestamp = decodeTime(timeStr);
            if (timestamp === null) return null;
            return {id, randomness: randStr, date: new Date(timestamp), stub, encodedTime: timeStr};
        } else {
            if (id.length < 8) return null;
            const timeStr = id.substring(0, 8);
            const randStr = id.substring(8);
            const timestamp = decodeTime(timeStr);
            if (timestamp === null) return null;
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
            if (charValue === undefined) return null;
            timestamp = timestamp * 64 + charValue;
        }
        return timestamp;
    }


    /**
     * @type {object}
     * The public API object that will be returned by the IIFE.
     */
    const publicApi = {

        newID: (options) => _generateObject(options).id,
        newObj: (options) => _generateObject(options),
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
            for (let i = 0; i < len; i++) chars[i] = PUSH_CHARS.charAt(Math.floor(prng() * 64));
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
            return hashIsh(input, len, PUSH_CHARS);
        },
        /**
         * Generates a new pushID where the random part is a hash of the provided data.
         * @param {object} [options] - Configuration object. Must include a `data` property.
         * @returns {string} A new, deterministically generated pushID.
         */
        newHashID: (options = {}) => publicApi.newID(options),
        /**
         * Decodes a pushID into a full object containing its parts.
         * @param {string} id - The pushID to decode.
         * @returns null | {{id: string, randomness: string, date: Date, stub: string|null, encodedTime: string}} The decoded object.
         */
        decodeID: (id) => {
            try {
                return decodeObj(id);
            } catch (e) {
                return null;
            }
        },
        /**
         * Decodes a pushID into a full object containing its parts.
         * @param {string} id - The pushID to decode.
         * @returns null | {{id: string, randomness: string, date: Date, stub: string|null, encodedTime: string}} The decoded object.
         */
        tryDecodeID: (id) => {
            try {
                return decodeObj(id);
            } catch (e) {
                return null;
            }
        },
        /**
         * Decodes a pushID and returns its creation time in milliseconds.
         * @param {string} id - The pushID to decode.
         * @returns {number} The timestamp in milliseconds.
         */
        decodeTime: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.date.getTime() : null;
        },
        /**
         * Decodes a pushID and returns its creation time as a Date object.
         * @param {string} id - The pushID to decode.
         * @returns {Date} The creation date of the ID.
         */
        decodeDate: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.date : null;
        },
        /**
         * Decodes a pushID and returns its random part.
         * @param {string} id - The pushID to decode.
         * @returns {string} The randomness string.
         */
        decodeStr: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.randomness : null;
        },
        /**
         * Decodes a pushID and returns its stub.
         * @param {string} id - The pushID to decode.
         * @returns {string|null} The stub, or null for legacy IDs.
         */
        decodeStub: (id) => {
            const d = publicApi.tryDecodeID(id);
            return d ? d.stub : null;
        },
    };
    publicApi.next = publicApi.newID;
    publicApi.nextID = publicApi.newID;
    publicApi.nextObj = publicApi.newObj;
    publicApi.previous = publicApi.previousID;
    publicApi.prevObj = publicApi.previousObj;
    publicApi.nextHashID = publicApi.newHashID;
    publicApi.prevHashID = publicApi.previousID;
    return publicApi;
})();