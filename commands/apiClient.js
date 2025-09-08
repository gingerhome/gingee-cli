const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const configDir = path.join(os.homedir(), '.gingerjs');
const credsDir = path.join(configDir, 'sessions');

/**
 * Sanitizes a server URL into a safe filename.
 * @private
 */
function getCredsFilePath(serverUrl) {
    // Use a hash to create a unique, fixed-length, safe filename
    const hash = crypto.createHash('sha256').update(serverUrl).digest('hex');
    if (!fs.existsSync(credsDir)) {
        fs.mkdirSync(credsDir);
    }
    return path.join(credsDir, `${hash}.json`);
}

/**
 * Creates an authenticated axios instance by manually adding the session cookie.
 * @returns {Promise<{client: import('axios').AxiosInstance, serverUrl: string}>}
 */
async function getAuthenticatedClient(serverUrl = 'http://localhost:7070') {
    const credsPath = getCredsFilePath(serverUrl);

    if (!fs.existsSync(credsPath)) {
        throw new Error("You are not logged in. Please run `gingerjs login <server-url>` first.");
    }
    
    const { cookie } = fs.readJsonSync(credsPath);
    if (!serverUrl || !cookie) {
        throw new Error("Credentials file is corrupted or empty. Please log in again.");
    }
    
    // Create a standard axios instance.
    const client = axios.create();
    
    // Manually set the 'Cookie' header for all requests made with this instance.
    client.defaults.headers.common['Cookie'] = cookie;
    
    return { client, serverUrl };
}

function deleteSession(serverUrl) {
    const credsPath = getCredsFilePath(serverUrl);
    if (fs.existsSync(credsPath)) {
        fs.removeSync(credsPath);
    }
}

async function installApp(serverUrl, appName, ginFileName, ginFileBuffer, permissions) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('appName', appName);
    form.append('package', ginFileBuffer, ginFileName);
    form.append('permissions', JSON.stringify(permissions));

    const response = await client.post(`${serverUrl}/glade/api/install`, form, {
        headers: form.getHeaders()
    });
    return response.data;
}

async function upgradeApp(serverUrl, appName, ginFileName, ginFileBuffer, permissions) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('appName', appName);
    form.append('package', ginFileBuffer, ginFileName);
    form.append('permissions', JSON.stringify(permissions));

    const response = await client.post(`${serverUrl}/glade/api/upgrade`, form, {
        headers: form.getHeaders()
    });
    return response.data;
}

async function deleteApp(serverUrl, appName) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const response = await client.get(`${serverUrl}/glade/api/delete?app=${appName}`);
    return response.data;
}

async function rollbackApp(serverUrl, appName, grantedPermissions) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const response = await client.post(`${serverUrl}/glade/api/rollback`, {
        appName,
        permissions: grantedPermissions
    });
    return response.data;
}

async function listBackups(serverUrl, appName) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const response = await client.get(`${serverUrl}/glade/api/list-backups?app=${appName}`);
    return response.data;
}

async function packageApp(serverUrl, appName) {
    const { client } = await getAuthenticatedClient(serverUrl);
    // CRITICAL: We expect a binary stream, so set responseType to 'stream'.
    const response = await client.get(`${serverUrl}/glade/api/package?app=${appName}`, {
        responseType: 'stream'
    });
    return response;
}

async function analyzeBackup(serverUrl, appName) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const response = await client.get(`${serverUrl}/glade/api/analyze-backup?app=${appName}`);
    return response.data;
}

async function getAppPermissions(serverUrl, appName) {
    const { client } = await getAuthenticatedClient(serverUrl);
    const response = await client.get(`${serverUrl}/glade/api/get-permissions?app=${appName}`);
    return response.data;
}

module.exports = { 
    getCredsFilePath, 
    getAuthenticatedClient, 
    deleteSession,
    installApp,
    upgradeApp,
    deleteApp,
    rollbackApp,
    listBackups,
    packageApp,
    analyzeBackup,
    getAppPermissions
};
