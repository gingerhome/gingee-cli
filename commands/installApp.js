const fs = require('fs-extra');
const path = require('path');
const { 
    _unzipBuffer, 
    _repackApp, 
    _getPermissions, 
    _getDbRequirements, 
    _getHttpClientErrorMessage,
    _readAppPreset,
    _validateAppPreset,
    _substituteEnvVars
} = require('./installerUtils');
const apiClient = require('./apiClient');

async function installApp(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const spinner = ora('Preparing to install application...').start();
    const tempDir = path.join(require('os').tmpdir(), `ginger-install-local-${Date.now()}`);

    try {
        const { serverUrl = 'http://localhost:7070', appName, ginPath: ginFilePath, file: presetFilePath } = options;
        let finalPermissions, finalDbConfig;

        if (!fs.existsSync(ginFilePath)) {
            throw new Error(`Package file not found at: ${ginFilePath}`);
        }

        spinner.start(`Reading package ${path.basename(ginFilePath)}...`);
        const packageBuffer = fs.readFileSync(ginFilePath);

        // Unpack and get user consent/config
        await fs.ensureDir(tempDir);
        const unpackedPath = path.join(tempDir, 'unpacked');
        await _unzipBuffer(packageBuffer, unpackedPath);
        spinner.succeed('Package read.');

        if(presetFilePath) {
            console.log(chalk.blueBright(`Running in non-interactive mode using preset file: ${presetFilePath}`));
            const preset = _readAppPreset(presetFilePath);
            _validateAppPreset(preset, 'install'); // Assumes 'install' key exists in preset
            finalPermissions = preset.install.consent.grantPermissions;
            finalDbConfig = _substituteEnvVars(preset.install.config.db);
        }else{
            finalPermissions = await _getPermissions(unpackedPath);
            finalDbConfig = await _getDbRequirements(unpackedPath);
        }

        // Modify and Repack
        spinner.start('Applying configuration and repacking...');
        const appJsonPath = path.join(unpackedPath, 'box', 'app.json');
        const appJson = await fs.readJson(appJsonPath);
        if (finalDbConfig.length > 0) {
            appJson.db = finalDbConfig;
        }
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
        
        const finalPackageBuffer = await _repackApp(unpackedPath);
        spinner.succeed('Configuration applied and package repacked.');

        // Infer appName from the filename without the .gin extension
        spinner.text = `Installing app '${appName}' to server ${serverUrl}...`;

        const result = await apiClient.installApp(serverUrl, appName, path.basename(ginFilePath), finalPackageBuffer, finalPermissions);
        if (result.status !== 'success') {
            throw new Error(result.message || 'Server responded with an unknown error.');
        }

        const successMsg = chalk.bgGreen('✅ Success!') + chalk.blueBright(` App '${appName}' installed.`);
        spinner.succeed(successMsg);

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
    }
}

module.exports = { installApp };
