const apiClient = require('./apiClient');
const { _getHttpClientErrorMessage, _getRollbackPermissions, _readAppPreset, _validateAppPreset } = require('./installerUtils'); // Use the new, specific utility

async function rollbackApp(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const { default: inquirer } = await import('inquirer');
    const { serverUrl, appName, file: presetFilePath } = options;
    let finalPermissions;
    const spinner = ora();

    try {
        if (presetFilePath) {
            // --- NON-INTERACTIVE MODE ---
            console.log(chalk.blueBright(`Running in non-interactive mode using preset file: ${presetFilePath}`));
            const preset = _readAppPreset(presetFilePath);
            _validateAppPreset(preset, 'rollback');
            finalPermissions = preset.rollback.consent.grantPermissions;
            console.log(chalk.blueBright(`Permissions to be granted upon rollback: [${finalPermissions.join(', ')}]`));
        } else {
            spinner.start(`Analyzing latest backup for '${appName}'...`);
            const analysis = await apiClient.analyzeBackup(serverUrl, appName);
            if (analysis.status !== 'success') throw new Error(analysis.error || 'Failed to analyze backup.');

            const currentPermsResponse = await apiClient.getAppPermissions(serverUrl, appName);
            if (currentPermsResponse.status !== 'success') throw new Error(currentPermsResponse.error || 'Failed to get current permissions.');
            spinner.succeed('Backup analysis complete.');

            console.log(chalk.blueBright(`\nThis will roll back '${appName}' to version ${analysis.version}.`));

            const { proceed } = await inquirer.prompt([{
                type: 'confirm',
                name: 'proceed',
                message: 'Are you sure you want to proceed with the rollback?',
                default: false
            }]);
            if (!proceed) throw new Error('Rollback cancelled by user.');
            finalPermissions = await _getRollbackPermissions(analysis.permissions, currentPermsResponse.grantedPermissions);
        }

        spinner.start(`Executing rollback for '${appName}'...`);
        const result = await apiClient.rollbackApp(serverUrl, appName, finalPermissions);

        if (result.status !== 'success') {
            throw new Error(result.message || 'Server responded with an unknown error.');
        }

        spinner.succeed(chalk.bgGreen(`✅ Success!`), chalk.blueBright(`App '${appName}' has been rolled back.`));

    } catch (err) {
        spinner.fail(chalk.blueBright('Rollback failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = _getHttpClientErrorMessage(err);
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(message));
        }
        process.exit(1);
    }
}

module.exports = { rollbackApp };
