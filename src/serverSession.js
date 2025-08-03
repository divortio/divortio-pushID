

/**
 * @fileoverview A server-side storage handler for sessionManager.
 * @version 1.0.0
 *
 * This library is designed for server-side JavaScript environments like Cloudflare Workers or Node.js.
 * It manages session state by interacting with request and response headers, specifically the
 * `Cookie` and `Set-Cookie` headers.
 *
 * It implements a dual-cookie strategy for enhanced security and flexibility:
 * 1.  **HTTP-Only Server Cookie**: A secure cookie (`HttpOnly`, `Secure`, `SameSite=Strict`) that is
 * only accessible by the server. This is the primary, trusted source of session state.
 * The key for this cookie is prefixed with `_ss_` (server-side).
 * 2.  **Client-Accessible Cookie**: A secure cookie (`Secure`, `SameSite=Strict`) that is readable
 * by client-side JavaScript. This can be used for non-sensitive UI purposes, like displaying
 * a session ID for debugging. The key for this cookie is prefixed with `_cs_` (client-side).
 *
 * This approach ensures that sensitive session identifiers are protected from XSS attacks, while
 * still allowing the client to access a copy of the data if needed.
 */

/**
 * @typedef {object} ServerStorageConfig
 * @property {string} [prefix=''] - An optional prefix for all cookie keys. The library will append `_ss_` or `_cs_`.
 * @property {object} [cookieOptions] - Default options for setting cookies.
 * @property {string} [cookieOptions.path='/'] - The path for the cookie.
 * @property {boolean} [cookieOptions.secure=true] - The secure flag for the cookie. Defaults to true.
 * @property {string} [cookieOptions.sameSite='Strict'] - The SameSite attribute. Defaults to 'Strict' for security.
 * @property {string} [cookieOptions.domain] - The domain for the cookie. It's often best to let the browser set this automatically by not including it.
 */

/**
 * @typedef {object} SetCookieOptions
 * @property {Date} [expires] - The expiration date of the cookie.
 * @property {string} [path] - The path for the cookie.
 * @property {boolean} [secure] - The secure flag.
 * @property {string} [sameSite] - The SameSite attribute.
 * @property {string} [domain] - The domain for the cookie.
 * @property {boolean} [httpOnly] - The HttpOnly flag.
 */

/**
 * Factory function that creates a server-side storage handler.
 * This handler is not stateful; it provides pure functions to parse request cookies
 * and generate response `Set-Cookie` headers.
 *
 * @param {ServerStorageConfig} [config={}] - Configuration for the server storage handler.
 * @returns {{get: function(string, string): (string|null), set: function(string, string, object): string[], clear: function(): string[], config: ServerStorageConfig}} A storage handler object.
 */
export const serverStorage = (config = {}) => {
    const finalConfig = {
        prefix: '',
        cookieOptions: {
            path: '/',
            secure: true,
            sameSite: 'Strict',
        },
        ...config,
    };

    /**
     * Parses an incoming `Cookie` header string to retrieve a session value.
     * It prioritizes the server-side (`_ss_`) cookie, falling back to the
     * client-side (`_cs_`) cookie if the server one is not found.
     *
     * @param {string} key - The key of the value to retrieve (e.g., 'cID', 'sID').
     * @param {string} cookieHeader - The raw `Cookie` header string from the incoming request.
     * @returns {string|null} The retrieved value, or null if not found.
     *
     * @example
     * // In a Cloudflare Worker or similar environment
     * const storage = serverStorage({ prefix: 'myapp' });
     * const cookieHeader = request.headers.get('Cookie'); // "myapp_ss_sID=some-id; myapp_cs_sID=some-id"
     * const sessionId = storage.get('sID', cookieHeader);
     * console.log(sessionId); // "some-id"
     */
    const get = (key, cookieHeader = '') => {
        if (!cookieHeader) return null;

        const serverKey = `${finalConfig.prefix}_ss_${key}`;
        const clientKey = `${finalConfig.prefix}_cs_${key}`;

        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [name, value] = cookie.trim().split('=');
            acc[name] = value;
            return acc;
        }, {});

        const serverValue = cookies[serverKey] ? decodeURIComponent(cookies[serverKey]) : null;
        if (serverValue) return serverValue;

        const clientValue = cookies[clientKey] ? decodeURIComponent(cookies[clientKey]) : null;
        return clientValue;
    };

    /**
     * Generates an array of `Set-Cookie` header strings for a given key-value pair.
     * It creates two headers: one for the secure HttpOnly cookie and one for the
     * client-accessible cookie.
     *
     * @param {string} key - The key of the item to set (e.g., 'cID').
     * @param {string} value - The value to store.
     * @param {SetCookieOptions} options - Cookie options, like `expires`.
     * @returns {string[]} An array of two `Set-Cookie` header strings.
     *
     * @example
     * // In a server-side environment
     * const storage = serverStorage();
     * const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
     * const cookieHeaders = storage.set('sID', 'new-session-id', { expires: expiry });
     *
     * // response.headers.append('Set-Cookie', cookieHeaders[0]);
     * // response.headers.append('Set-Cookie', cookieHeaders[1]);
     * console.log(cookieHeaders);
     * // [
     * //   "_ss_sID=new-session-id; Path=/; Expires=...; Secure; HttpOnly; SameSite=Strict",
     * //   "_cs_sID=new-session-id; Path=/; Expires=...; Secure; SameSite=Strict"
     * // ]
     */
    const set = (key, value, options = {}) => {
        const serverKey = `${finalConfig.prefix}_ss_${key}`;
        const clientKey = `${finalConfig.prefix}_cs_${key}`;
        const mergedOptions = {...finalConfig.cookieOptions, ...options};

        const buildCookieString = (name, val, opts) => {
            let str = `${name}=${encodeURIComponent(val)}`;
            if (opts.path) str += `; Path=${opts.path}`;
            if (opts.expires) str += `; Expires=${opts.expires.toUTCString()}`;
            if (opts.domain) str += `; Domain=${opts.domain}`;
            if (opts.secure) str += `; Secure`;
            if (opts.httpOnly) str += `; HttpOnly`;
            if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
            return str;
        };

        const serverCookieOptions = {...mergedOptions, httpOnly: true};
        const clientCookieOptions = {...mergedOptions, httpOnly: false};

        return [
            buildCookieString(serverKey, value, serverCookieOptions),
            buildCookieString(clientKey, value, clientCookieOptions),
        ];
    };

    /**
     * Generates an array of `Set-Cookie` headers to clear all session cookies.
     * It does this by setting the cookies with an expiration date in the past.
     *
     * @returns {string[]} An array of `Set-Cookie` headers that will clear the cookies.
     *
     * @example
     * // On logout, clear the session cookies
     * const storage = serverStorage();
     * const clearCookieHeaders = storage.clear();
     * // Append these headers to the response to clear cookies on the client
     */
    const clear = () => {
        const keys = ['cID', 'sID', 'eID', 'seqID'];
        const pastDate = new Date(0);
        let clearHeaders = [];

        keys.forEach(key => {
            const headers = set(key, '', {expires: pastDate});
            clearHeaders.push(...headers);
        });

        return clearHeaders;
    };

    return {get, set, clear, config: finalConfig};
};