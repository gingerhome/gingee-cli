const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { 
    _unzipBuffer, 
    _repackApp, 
    _getUpgradePermissions, 
    _getDbRequirements, 
    _resolveStoreUrl,
    _resolveDownloadUrl
} = require('./installerUtils');
const apiClient = require('./apiClient');

async function upgradeStoreApp(appName, options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const spinner = ora();
    const tempDir = path.join(os.tmpdir(), `gingee-upgrade-store-${Date.now()}`);

    const { gStoreUrl, serverUrl } = options;

    try {
        await apiClient.ensureAuthenticated(serverUrl);

        // 1. Resolve URL and fetch the store manifest
        const resolvedStoreUrl = _resolveStoreUrl(gStoreUrl);
        spinner.start(`Fetching manifest from ${resolvedStoreUrl}...`);
        
        const manifestResponse = await axios.get(resolvedStoreUrl);
        const appConfig = manifestResponse.data.apps.find(a => a.installName === appName);
        if (!appConfig) {
            throw new Error(`App '${appName}' not found in the store manifest.`);
        }
        spinner.succeed('Found app in store manifest.');

        // 2. Resolve the download URL and download the new package
        const downloadUrl = _resolveDownloadUrl(resolvedStoreUrl, appConfig.download_url);
        spinner.start(`Downloading new package from ${downloadUrl}...`);
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        const packageBuffer = downloadResponse.data;
        spinner.succeed('New package downloaded.');

        // 3. Unpack the new package to a temporary directory
        await fs.ensureDir(tempDir);
        const unpackedPath = path.join(tempDir, 'unpacked');
        await _unzipBuffer(packageBuffer, unpackedPath);

        // 4. Fetch the currently granted permissions for the installed app
        spinner.start(`Fetching current permissions for '${appName}'...`);
        const currentPermsResponse = await apiClient.getAppPermissions(serverUrl, appName);
        if (currentPermsResponse.status !== 'success') {
            throw new Error(currentPermsResponse.error || 'Could not fetch current permissions.');
        }
        spinner.succeed('Current permissions fetched.');

        // 5. Run the interactive permission comparison and consent prompt
        const grantedPermissions = await _getUpgradePermissions(unpackedPath, currentPermsResponse.grantedPermissions);
        
        // 6. Run the interactive database configuration prompt
        const dbConfigUpdates = await _getDbRequirements(unpackedPath);

        // 7. Repackage the app with the new configuration
        spinner.start('Applying configuration and repacking...');
        const appJsonPath = path.join(unpackedPath, 'box', 'app.json');
        const appJson = await fs.readJson(appJsonPath);
        if (dbConfigUpdates.length > 0) {
            appJson.db = dbConfigUpdates;
        }
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
        
        const finalPackageBuffer = await _repackApp(unpackedPath);
        spinner.succeed('Configuration applied and package repacked.');

        // 8. Execute the upgrade via the API client
        spinner.start(`Upgrading '${appName}' on ${serverUrl}...`);
        const result = await apiClient.upgradeApp(serverUrl, appName, `${appName}.gin`, finalPackageBuffer, grantedPermissions);

        if (result.status !== 'success') {
            throw new Error(result.message || 'Server responded with an unknown error.');
        }
        spinner.succeed(chalk.bgGreen(`✅ Success! App '${appName}' upgraded on ${serverUrl}.`));

    } catch (err) {
        spinner.fail(chalk.bgRed('Upgrade failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${err.message}`));
        }
        process.exit(1);
    } finally {
        // 9. Cleanup
        await fs.remove(tempDir);
    }
}

module.exports = { upgradeStoreApp };
