/**
 * @fileoverview Durable Object for session management.
 * @version 1.1.0
 *
 * This Durable Object class acts as a STATELESS, single-threaded processing unit
 * to prevent session race conditions. It does not persist any state itself between
 * requests. All necessary state is received via the request's Cookie header, and
 * the new state is returned entirely within the response's Set-Cookie headers.
 *
 * It exposes two primary interfaces for a parent worker to use:
 * 1. An RPC method `process(cookieHeader)`: This is the recommended, most efficient method.
 * 2. A standard `fetch(request)` handler for direct HTTP interaction or testing.
 */

import {sessionManager} from './lib/sessionManager.js';
import {serverStorage} from './lib/clientServerSession.js';

/**
 * @typedef {object} ProcessedSessionData
 * @description The object returned by the core sessionManager logic, detailing the session's state.
 * @property {string} cID - The current Client ID.
 * @property {string} sID - The current Session ID.
 * @property {string} eID - The newly generated Event ID.
 * @property {string} seqID - The new Sequence ID (e.g., "1-5").
 * @property {Date} clientTime - The timestamp of the cID.
 * @property {Date} sessionTime - The timestamp of the sID.
 * @property {Date} eventTime - The timestamp of the eID.
 * @property {object} newState - The full current state object.
 * @property {object} oldState - The state before this event was processed.
 * @property {object} changes - A summary of what changed (e.g., isNewSession).
 */

/**
 * @typedef {object} ProcessResponse
 * @description The object returned by the `process()` RPC method.
 * @property {ProcessedSessionData} sessionData - The complete, processed session data.
 * @property {string[]} setCookieHeaders - An array of `Set-Cookie` header strings to be added to the final response.
 */

export class SessionManagerDO {
    /**
     * The constructor is called once when the Durable Object is first created.
     * @param {DurableObjectState} ctx - The context provides access to features like storage (not used here).
     * @param {object} env - The environment object containing bindings.
     */
    constructor(ctx, env) {
        this.env = env;

        // Initialize the core session logic and server storage handler one time.
        // These instances are reused for every request handled by this object.
        this.sessionManager = sessionManager();
        this.storage = serverStorage();
    }

    /**
     * The primary RPC (Remote Procedure Call) method.
     * This is the most efficient way for a parent worker to process a session, as it
     * avoids the overhead of creating and parsing full HTTP Request/Response objects.
     *
     * @param {string | null} cookieHeader - The raw `Cookie` header string from the original client request.
     * @returns {Promise<ProcessResponse>} A promise that resolves to an object containing the session data and the Set-Cookie headers.
     *
     * @example
     * // --- How to use this RPC method in a parent worker ---
     *
     * export default {
     * async fetch(request, env, ctx) {
     * // ... logic to get the durableObjectStub for this user
     *
     * const cookieHeader = request.headers.get('Cookie');
     *
     * // 1. Call the RPC method directly.
     * const { sessionData, setCookieHeaders } = await durableObjectStub.process(cookieHeader);
     *
     * // 2. You now have the session data for logging or other logic.
     * console.log(`Processing event ${sessionData.eID} for client ${sessionData.cID}`);
     * if (sessionData.changes.isNewSession) {
     * // Fire a "session_start" analytics event, etc.
     * }
     *
     * // 3. Create your final response to the user.
     * const response = new Response("Hello, this is the main page content!");
     *
     * // 4. Attach the Set-Cookie headers provided by the DO.
     * setCookieHeaders.forEach(header => {
     * response.headers.append('Set-Cookie', header);
     * });
     *
     * return response;
     * }
     * };
     */
    async process(cookieHeader) {
        // This temporary handler exists only for this single request. It allows the
        // sessionManager to "get" and "set" values from an in-memory object.
        const inMemoryStorageHandler = () => {
            let state = {};
            const get = (key) => state[key] || this.storage.get(key, cookieHeader);
            const set = (key, value) => {
                state[key] = value;
            };
            const clear = () => {
                state = {};
            };
            return {get, set, clear, config: {}};
        };

        // Run the core session logic using our temporary, in-memory storage.
        const sessionData = this.sessionManager.process({
            storageHandler: inMemoryStorageHandler(),
        });

        // Take the final state and generate the real `Set-Cookie` headers.
        const {cID, sID, eID, seqID} = sessionData.newState;
        const cIDExpiry = new Date("2038-01-19T03:14:07.000Z"); // Set a far-future date
        const sessionExpiry = new Date(Date.now() + this.sessionManager.config.sessionTimeout);

        const setCookieHeaders = [
            ...this.storage.set('cID', cID, {expires: cIDExpiry}),
            ...this.storage.set('sID', sID, {expires: sessionExpiry}),
            ...this.storage.set('eID', eID, {expires: sessionExpiry}),
            ...this.storage.set('seqID', seqID, {expires: sessionExpiry}),
        ];

        // Return everything the parent worker needs.
        return {sessionData, setCookieHeaders};
    }

    /**
     * Handles traditional HTTP requests forwarded from the main worker.
     * This method acts as a standard HTTP wrapper around the `process()` RPC method.
     *
     * @param {Request} request - The incoming request.
     * @returns {Promise<Response>} A Response object containing the session data as JSON
     * and the necessary `Set-Cookie` headers.
     *
     * @example
     * // --- How to use this fetch handler in a parent worker ---
     *
     * export default {
     * async fetch(request, env, ctx) {
     * // ... logic to get the durableObjectStub for this user
     *
     * // Simply forward the request and return the DO's response directly.
     * // The DO's response will contain the session data as a JSON body
     * // and all the necessary Set-Cookie headers.
     * return durableObjectStub.fetch(request);
     * }
     * };
     */
    async fetch(request) {
        const cookieHeader = request.headers.get('Cookie');

        // Call our core logic via the RPC method.
        const {sessionData, setCookieHeaders} = await this.process(cookieHeader);

        // Create a new Response object.
        const response = new Response(JSON.stringify(sessionData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Append all the `Set-Cookie` headers to the response.
        setCookieHeaders.forEach((header) => {
            response.headers.append('Set-Cookie', header);
        });

        return response;
    }
}