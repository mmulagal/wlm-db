import auth0 from 'auth0-js';
import queryString from "query-string";

const randomString = function (length) {
    let text = '';
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const logParams = function(params) {
    let allParams = ['service', 'disableSignup', 'startOnSignup', 'displayEvent']; //list of all possible params for Login Page
    let sawUnexpected = false;
    Object.keys(params).forEach((key) => {
        if(!allParams.includes(key)){
            sawUnexpected = true;
            // eslint-disable-next-line
            console.log(`Unexpected parameter passed to loginRedirect: ${key}`)
        }
    });
    if (sawUnexpected) {
        // eslint-disable-next-line
        console.log(`Expected parameters are: ${allParams.join(", ")}`)
    }
};

const determineStage = function(opts){ //defaults to production (empty string)
    if(!opts || !opts.domain){
        return "";
    } else{
        if (opts.domain.indexOf("staging") !== -1) return "staging.";
        else if (opts.domain.indexOf("dev") !== -1) return "dev.";
        else return "";
    }
};

class Auth {
    constructor(opts){
        if(!opts.clientID) throw new Error("Missing clientID from opts");
        if(!opts.audience) throw new Error("Missing audience from opts");

        this.auth = new auth0.WebAuth(Object.assign({
            domain: "netapp-cloud-account.auth0.com",
            redirectUri: window.location.origin,
            responseType: 'token id_token',
            scope: 'openid profile email',
            leeway: 30
        }, opts));

        this.stage = determineStage(opts);
        this.loginRedirect = this.loginRedirect.bind(this);
        this.refreshSso = this.refreshSso.bind(this);
        this.logout = this.logout.bind(this);
    }

    loginRedirect(auth0Opts, paramsForLoginPage, paramsForUI){
        logParams(paramsForLoginPage);
        const extra = paramsForLoginPage ? `?paramsForLoginPage=${window.btoa(JSON.stringify(paramsForLoginPage))}` : '';
        const {origin} = window.location;
        const redirectUri = `${origin}/${extra}`;
        this.auth.authorize(Object.assign({
            state: window.btoa(JSON.stringify(Object.assign({rand: randomString(30)}, paramsForUI))),
            redirectUri,
        }, auth0Opts));
    }

    refreshSso({auth0Opts, paramsForUI, allowLoginRedirect}) {
        const authenticate = (err, authResult, resolve, reject, firstTime) => {
            if (authResult && authResult.accessToken && authResult.idToken) {
                try {
                    authResult.paramsForUI = JSON.parse(window.atob(authResult.state));
                } catch (e) {
                    // eslint-disable-next-line
                    console.log(`refreshSSo error parsing authResult.state ${JSON.stringify(e)}`);
                }
                resolve(authResult); //success case
            }
            else{
                //case err == null: (happens for very specific errors - auth0 doesn't generate err obj) fill with 'unknown error'
                if (!err) err = {error: "unknown error", errorDescription: "Unknown error. Try to refresh or contact support"};

                //case 'login required': set needLogin flag to true and reject err obj. Caller should then call loginRedirect
                if (err.error === "login_required") {
                    err.needLogin = true;
                    reject(err);
                } else if(!allowLoginRedirect || (firstTime && (err.errorDescription === "Nonce does not match." || err.errorDescription === "`state` does not match."))){
                    reject(err);
                } else {
                    //for all other errors - redirect to NetApp SaaS Portal Error Page with included error description
                    window.location.href = `https://${this.stage}services.cloud.netapp.com/error-page?error=${err.error}&error_description=${err.errorDescription}`;
                }
            }
        };

        const renewOnce = (firstTime) => {
            return new Promise((resolve, reject) => {

                window.addEventListener('message', (event) => {
                    if (event.data.type === 'netapp:silent-authentication') {
                        if (!allowLoginRedirect) {
                            reject(event.data.hash);
                        } else {
                            window.location.href = `https://${this.stage}services.cloud.netapp.com/error-page?${event.data.hash}`;
                        }
                    }
                });

                this.auth.checkSession(Object.assign({
                    state: window.btoa(JSON.stringify(Object.assign({rand: randomString(30)}, paramsForUI)))
                }, auth0Opts), (err, authResult) => {
                    authenticate(err, authResult, resolve, reject, firstTime);
                });
            })
        };

        const parseHashOnce = () => {
            return new Promise((resolve, reject) => {
                this.auth.parseHash((err, authResult) => {
                    authenticate(err, authResult, resolve, reject, true)
                });
            })
        };

        return new Promise((resolve, reject) => {
            let refreshPromise = null;
            if (window.location.hash && (window.location.hash.indexOf('access_token') > 0 || window.location.hash.indexOf('error') > 0)) {
                if (window.location.href.indexOf('#!/#access_token') !== -1) window.history.pushState({}, null, window.location.href.replace('#!/'));
                refreshPromise = parseHashOnce()
            } else {
                refreshPromise = renewOnce(true)
            }

            return refreshPromise.catch(err => {
                if (err.errorDescription === 'Nonce does not match.' || err.errorDescription === '`state` does not match.') {
                    return renewOnce(false);
                } else throw err;
            }).then(resolve, reject)
        });
    }

    logout(opts) {
        this.auth.logout(Object.assign({returnTo: window.location.origin, federated: true}, opts))
    }
}

export default Auth;

export const refreshSso = ({allowLoginRedirect, handleAuthSuccess, handleAuthFailed}) => {
    const loginFail = err => {

        /* eslint-disable no-console */
        console.log('SSO return error:');
        console.log(err);
        /* eslint-enable no-console */

        if (err?.needLogin && allowLoginRedirect) {
            const query = queryString.parse(window.location.search);
            //for any other error than "needLogin" we don't want to login again, we want to show the oops
            window.auth.loginRedirect({}, {
                startOnSignup: (query?.su),
                service: "application-templates"
            });
        } else {
            handleAuthFailed(err || "Unknown error during authentication");
        }
    };
    const loginSuccess = authResult => {
        const {accessToken} = authResult;
        const userMetadata = btoa(JSON.stringify(authResult.idTokenPayload));

        handleAuthSuccess({accessToken, userMetadata});

        //Automatic login
        setTimeout(() => {
            refreshSso({allowLoginRedirect, handleAuthSuccess, handleAuthFailed});
        }, authResult.expiresIn * 1000 - 10000);
    };
    window.auth.refreshSso({allowLoginRedirect}).then(loginSuccess, loginFail);
}
