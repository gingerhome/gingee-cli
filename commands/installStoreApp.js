const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { 
    _unzipBuffer, 
    _repackApp, 
    _getPermissions, 
    _getDbRequirements, 
    _resolveStoreUrl,
    _resolveDownloadUrl,
    _getHttpClientErrorMessage
} = require('./installerUtils');
const apiClient = require('./apiClient');

async function installStoreApp(appName, options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const spinner = ora();
    const tempDir = path.join(os.tmpdir(), `gingee-install-${Date.now()}`);

    const { gStoreUrl, serverUrl } = options;

    try {
        // Step 1: Resolve the manifest URL using the new utility
        const resolvedStoreUrl = _resolveStoreUrl(gStoreUrl);
        spinner.start(`Fetching manifest from ${resolvedStoreUrl}...`);
        
        const manifestResponse = await axios.get(resolvedStoreUrl);
        const appConfig = manifestResponse.data.apps.find(a => a.name === appName);
        if (!appConfig) {
            throw new Error(`App '${appName}' not found in the store manifest.`);
        }
        spinner.succeed('Found app in store manifest.');
        
        // Step 2: Resolve the download URL using the new utility
        const downloadUrl = _resolveDownloadUrl(resolvedStoreUrl, appConfig.download_url);
        
        spinner.start(`Downloading package from ${downloadUrl}...`);
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        const packageBuffer = downloadResponse.data;
        spinner.succeed('Package downloaded.');

        // Steps 3, 4, and 5 (Unpack, get user consent, repack, and install) are now identical
        // to the logic we've already defined, as they operate on the buffer.
        await fs.ensureDir(tempDir);
        const unpackedPath = path.join(tempDir, 'unpacked');
        await _unzipBuffer(packageBuffer, unpackedPath);

        const grantedPermissions = await _getPermissions(unpackedPath);
        const dbConfigUpdates = await _getDbRequirements(unpackedPath);
        
        spinner.start('Applying configuration and repacking...');
        const appJsonPath = path.join(unpackedPath, 'box', 'app.json');
        const appJson = await fs.readJson(appJsonPath);
        if (dbConfigUpdates.length > 0) {
            appJson.db = dbConfigUpdates;
        }
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
        
        const finalPackageBuffer = await _repackApp(unpackedPath);
        spinner.succeed('Configuration applied and package repacked.');

        spinner.start(`Installing '${appName}' on ${serverUrl}...`);
        const result = await apiClient.installApp(serverUrl, appName, `${appName}.gin`, finalPackageBuffer, grantedPermissions);
        if (result.status !== 'success') {
            throw new Error(result.message || 'Server responded with an unknown error.');
        }
        spinner.succeed(chalk.bgGreen(`✅ Success!`));
        console.log(chalk.blueBright(` App '${appName}' installed on ${serverUrl}.`));

    } catch (err) {
        spinner.fail(chalk.bgRed('Installation failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = _getHttpClientErrorMessage(err);
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    } finally {
        await fs.remove(tempDir);
    }
}

module.exports = { installStoreApp };
