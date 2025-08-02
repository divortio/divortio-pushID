/**
 * Creates a stable, deterministic hash string from any JavaScript input.
 * @param {*} input - The value to hash (object, array, string, etc.).
 * @param {number} [length=12] - The desired length of the hash. Minimum is 12.
 * @returns {string} A stable hash string.
 */
export const hashIsh = (function () {
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
        return '{' + Object.keys(val).sort().map(key => JSON.stringify(key) + ':' + _serialize(val[key])).join(',') + '}';
    }

    return function (input, length, PUSH_CHARS) {
        const serialized = _serialize(input);
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

        const hashChars = new Array(length);
        for (let i = 0; i < length; i++) {
            const state = [h1, h2, h3, h4];
            const charIndex = (state[i % 4] >> ((i % 5) * 3)) & 63;
            hashChars[i] = PUSH_CHARS.charAt(charIndex);
        }
        return hashChars.join('');
    }
})();
