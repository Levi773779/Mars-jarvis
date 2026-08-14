/* ============================================================
   Mars Jarvis — auth.js
   Google Sign-In (GIS token client) + Drive authorization.
   No backend: the access token lives only in memory for this tab.
   ============================================================ */

const JarvisAuth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let profile = null;
  let gapiReady = false;
  let gisReady = false;
  let onStateChange = () => {};

  function setStateListener(fn) { onStateChange = fn; }

  function isSignedIn() { return Boolean(accessToken); }
  function getToken() { return accessToken; }
  function getProfile() { return profile; }

  function waitFor(check, timeout = 15000, interval = 150) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (check()) return resolve(true);
        if (Date.now() - start > timeout) return reject(new Error('Timed out waiting for Google scripts to load.'));
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  async function initGapiClient(apiKey) {
    await waitFor(() => typeof gapi !== 'undefined');
    await new Promise((resolve) => gapi.load('client', resolve));
    await gapi.client.init({
      apiKey,
      discoveryDocs: [JarvisConfig.DISCOVERY_DOC]
    });
    gapiReady = true;
  }

  async function init() {
    const creds = JarvisConfig.load();
    if (!creds.clientId || !creds.apiKey) {
      return { ok: false, reason: 'missing-credentials' };
    }

    await waitFor(() => typeof google !== 'undefined' && google.accounts);
    await initGapiClient(creds.apiKey);

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: creds.clientId,
      scope: JarvisConfig.DRIVE_SCOPE,
      callback: () => {} // overridden per-request in signIn()
    });
    gisReady = true;
    return { ok: true };
  }

  function signIn() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error('Google auth is not initialized. Save your credentials in Settings first.'));
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        gapi.client.setToken({ access_token: accessToken });
        fetchProfile().finally(() => {
          onStateChange({ signedIn: true, profile });
          resolve(accessToken);
        });
      };
      tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    });
  }

  async function fetchProfile() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) profile = await res.json();
    } catch {
      profile = null;
    }
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    profile = null;
    onStateChange({ signedIn: false, profile: null });
  }

  return {
    init,
    signIn,
    signOut,
    isSignedIn,
    getToken,
    getProfile,
    setStateListener,
    get gapiReady() { return gapiReady; },
    get gisReady() { return gisReady; }
  };
})();
