/**
 * @fileoverview A client-side storage handler for the sessionManager.
 * @version 1.0.0
 *
 * This library provides a storage handler specifically for browser environments.
 * It implements the required `get`, `set`, and `clear` methods that the
 * `sessionManager` needs to persist session identifiers.
 *
 * It features a robust storage strategy:
 * 1. It prioritizes using browser cookies for their ability to be sent with
 * every HTTP request, making them ideal for server-side integration.
 * 2. If cookies are disabled or unavailable (e.g., in a private Browse
 * session or due to user settings), it seamlessly falls back to using
 * `localStorage`. This ensures that session tracking continues to work
 * reliably for as many users as possible.
 */

/**
 * @typedef {object} ClientStorageConfig
 * @property {string} [cookiePrefix='__psh_'] - A prefix for all cookie and localStorage keys to avoid naming collisions.
 * @property {object} [cookieOptions] - Default options for setting cookies.
 * @property {string} [cookieOptions.path='/'] - The path for the cookie.
 * @property {boolean} [cookieOptions.secure=false] - The secure flag for the cookie. Should be true on HTTPS sites.
 * @property {string} [cookieOptions.sameSite='Lax'] - The SameSite attribute for the cookie.
 */

/**
 * @typedef {object} CookieOptions
 * @property {Date} [expires] - The expiration date of the cookie.
 * @property {string} [path] - The path for the cookie.
 * @property {boolean} [secure] - The secure flag for the cookie.
 * @property {string} [sameSite] - The SameSite attribute for the cookie.
 */

/**
 * Factory function that creates a client-side storage handler instance.
 *
 * @param {ClientStorageConfig} [config={}] - Configuration for the client storage handler.
 * @returns {{get: function(string): (string|null), set: function(string, string, CookieOptions): void, clear: function(): void, config: ClientStorageConfig}} A storage handler object with `get`, `set`, and `clear` methods.
 *
 * @example
 * // Initialize the client storage handler with a custom prefix
 * const storage = clientStorage({
 * cookiePrefix: '__myapp_',
 * cookieOptions: {
 * secure: true, // Recommended for production sites on HTTPS
 * sameSite: 'Strict'
 * }
 * });
 *
 * // Use it to set a value
 * const expiryDate = new Date();
 * expiryDate.setFullYear(expiryDate.getFullYear() + 1);
 * storage.set('cID', 'some-client-id', { expires: expiryDate });
 *
 * // Use it to get a value
 * const clientId = storage.get('cID');
 * console.log(clientId); // "some-client-id"
 *
 * // Use it with sessionManager
 * const manager = sessionManager();
 * const session = manager.process({ storageHandler: storage });
 */
export const clientStorage = (config = {}) => {
    const finalConfig = {
        cookiePrefix: '__pshC_',
        cookieOptions: {path: '/', secure: true, sameSite: 'Lax'},
        ...config,
    };

    let _isCookieEnabled = null;

    /**
     * Checks if cookies are enabled in the browser. The result is cached.
     * @private
     * @returns {boolean} True if cookies are enabled, false otherwise.
     */
    const _checkCookieEnabled = () => {
        if (typeof document === 'undefined') return false;
        if (_isCookieEnabled !== null) return _isCookieEnabled;
        try {
            // Attempt to set a test cookie
            document.cookie = "testcookie=1; SameSite=Lax";
            const enabled = document.cookie.indexOf("testcookie") !== -1;
            // Clean up the test cookie
            document.cookie = "testcookie=1; expires=Thu, 01-Jan-1970 00:00:01 GMT; SameSite=Lax";
            _isCookieEnabled = enabled;
            return enabled;
        } catch (e) {
            _isCookieEnabled = false;
            return false;
        }
    };

    /**
     * Retrieves a value from storage. It first tries cookies, then localStorage.
     *
     * @param {string} key - The key of the item to retrieve (e.g., 'cID').
     * @returns {string|null} The retrieved value, or null if not found.
     */
    const get = (key) => {
        const name = finalConfig.cookiePrefix + key;
        if (_checkCookieEnabled()) {
            const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
        } else if (typeof localStorage !== 'undefined') {
            const item = localStorage.getItem(name);
            if (!item) return null;
            try {
                const {value, expires} = JSON.parse(item);
                // Check for expiration if the item in localStorage has an expiry time
                if (expires && Date.now() > expires) {
                    localStorage.removeItem(name);
                    return null;
                }
                return value;
            } catch (e) {
                // If parsing fails, the item is invalid
                return null;
            }
        }
        return null;
    };

    /**
     * Saves a key-value pair to storage. It writes to both cookies (if enabled)
     * and localStorage.
     *
     * @param {string} key - The key of the item to set (e.g., 'sID').
     * @param {string} value - The value to store.
     * @param {CookieOptions} cookieOpts - Options for the cookie, especially the `expires` date.
     */
    const set = (key, value, cookieOpts) => {
        const name = finalConfig.cookiePrefix + key;
        const options = {...finalConfig.cookieOptions, ...cookieOpts};

        if (_checkCookieEnabled()) {
            let cookieString = `${name}=${encodeURIComponent(value)}`;
            for (const optKey in options) {
                const optValue = options[optKey];
                if (optValue instanceof Date) {
                    cookieString += `; ${optKey}=${optValue.toUTCString()}`;
                } else if (optValue !== undefined && optValue !== null) {
                    cookieString += `; ${optKey}=${optValue}`;
                }
            }
            document.cookie = cookieString;
        } else if (typeof localStorage !== 'undefined') {
            const expires = options.expires ? new Date(options.expires).getTime() : null;
            localStorage.setItem(name, JSON.stringify({value, expires}));
        }
    };

    /**
     * Clears all session-related keys from storage (both cookies and localStorage).
     */
    const clear = () => {
        const keys = ['cID', 'sID', 'eID', 'seqID'];
        keys.forEach(key => {
            const name = finalConfig.cookiePrefix + key;
            // Clear the cookie by setting an old expiration date
            if (_checkCookieEnabled()) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${finalConfig.cookieOptions.path}`;
            }
            // Remove the item from localStorage
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(name);
            }
        });
    };

    return {get, set, clear, config: finalConfig};
};