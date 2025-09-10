const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { _getHttpClientErrorMessage, _unzipBuffer, _repackApp, _getUpgradePermissions, _getDbRequirements, _readAppPreset, _validateAppPreset, _substituteEnvVars } = require('./installerUtils');
const apiClient = require('./apiClient');

async function upgradeApp(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const tempDir = path.join(os.tmpdir(), `gingee-upgrade-${Date.now()}`);

    const { serverUrl, appName, ginPath: ginFilePath, file: presetFilePath } = options;
    let finalPermissions, finalDbConfig;
    const spinner = ora();

    try {

        if (!fs.existsSync(ginFilePath)) {
            throw new Error(`Package file not found at: ${ginFilePath}`);
        }

        spinner.start(`Reading new package ${path.basename(ginFilePath)}...`);
        const packageBuffer = fs.readFileSync(ginFilePath);
        await fs.ensureDir(tempDir);
        const unpackedPath = path.join(tempDir, 'unpacked');
        await _unzipBuffer(packageBuffer, unpackedPath);
        spinner.succeed('New package unpacked.');

        if (presetFilePath) {
            // --- NON-INTERACTIVE MODE ---
            console.log(chalk.blueBright(`Running in non-interactive mode using preset file: ${presetFilePath}`));
            const preset = _readAppPreset(presetFilePath);
            _validateAppPreset(preset, 'upgrade');
            finalPermissions = preset.upgrade.consent.grantPermissions;
            finalDbConfig = _substituteEnvVars(preset.upgrade.config.db);
        } else {
            spinner.start(`Fetching current permissions for '${appName}'...`);
            const currentPermsResponse = await apiClient.getAppPermissions(serverUrl, appName);
            if (currentPermsResponse.status !== 'success') {
                throw new Error(currentPermsResponse.error || 'Could not fetch current permissions.');
            }
            spinner.succeed('Current permissions fetched.');

            finalPermissions = await _getUpgradePermissions(unpackedPath, currentPermsResponse.grantedPermissions);

            finalDbConfig = await _getDbRequirements(unpackedPath);
        }

        spinner.start('Applying configuration and repacking...');
        const appJsonPath = path.join(unpackedPath, 'box', 'app.json');
        const appJson = await fs.readJson(appJsonPath);
        if (finalDbConfig.length > 0) appJson.db = finalDbConfig;
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });

        const finalPackageBuffer = await _repackApp(unpackedPath);
        spinner.succeed('Configuration applied and package repacked.');

        spinner.start(`Upgrading '${appName}' on ${serverUrl}...`);
        const result = await apiClient.upgradeApp(serverUrl, appName, `${appName}.gin`, finalPackageBuffer, finalPermissions);

        if (result.status !== 'success') {
            throw new Error(result.message || 'Server responded with an unknown error.');
        }

        spinner.succeed(chalk.bgGreen(`✅ Success!`), chalk.blueBright(result.message || `App '${appName}' upgraded.`));

    } catch (err) {
        spinner.fail(chalk.bgRed('Upgrade failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = _getHttpClientErrorMessage(err);
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    }
}

module.exports = { upgradeApp };
