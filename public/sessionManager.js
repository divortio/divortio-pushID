
export {pushID} from './pushID.js';


/**
 * ===================================================================
 * sessionManager Library (v4.6.0 with seqID and API improvements)
 * ===================================================================
 */
export const sessionManager = (config = {}) => {
    const finalConfig = {
        sessionTimeout: 30 * 60 * 1000, randomnessLength: 12, cookiePrefix: '__psh_',
        cookieOptions: {path: '/', secure: false, sameSite: 'Lax'}, useStubs: false, ...config,
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
            const keys = ['cID', 'sID', 'eID', 'seqID'];
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

        let isSessionExpired = true;
        const lastActivityTime = prevEIDTime || sIDTime || cIDTime;
        if (lastActivityTime) {
            isSessionExpired = (Date.now() - lastActivityTime) > finalConfig.sessionTimeout;
        }

        const idOptions = {length: finalConfig.randomnessLength};
        const isNewClient = !cID;
        const isNewSession = !sID || isSessionExpired;

        const newEIDObj = pushID.newObj({...idOptions, stub: finalConfig.useStubs ? 'eID' : null});

        const finalCID = cID || (finalConfig.useStubs ? pushID.newID({...idOptions, stub: 'cID'}) : newEIDObj.id);
        const finalSID = isNewSession ? (finalConfig.useStubs ? pushID.newID({
            ...idOptions,
            stub: 'sID'
        }) : newEIDObj.id) : sID;

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

        const newState = {
            cID: finalCID, sID: finalSID, eID: newEIDObj.id, seqID: finalSeqID,
            clientTime: new Date(pushID.decodeTime(finalCID)),
            sessionTime: new Date(pushID.decodeTime(finalSID)),
            eventTime: newEIDObj.date
        };

        const changes = {isNewClient, isNewSession};

        const cIDExpiry = new Date();
        cIDExpiry.setFullYear(cIDExpiry.getFullYear() + 2);
        storageHandler.set('cID', newState.cID, {...finalConfig.cookieOptions, expires: cIDExpiry});
        const sessionExpiry = new Date(Date.now() + finalConfig.sessionTimeout);
        const sessionCookieOptions = {...finalConfig.cookieOptions, expires: sessionExpiry};
        storageHandler.set('sID', newState.sID, sessionCookieOptions);
        storageHandler.set('eID', newState.eID, sessionCookieOptions);
        storageHandler.set('seqID', newState.seqID, sessionCookieOptions);

        return {...newState, newState, oldState, changes};
    };

    return {process, clear: storageHandler.clear.bind(storageHandler), storageHandler, config: finalConfig};
};