const apiClient = require('./apiClient');
const { _getHttpClientErrorMessage } = require('./installerUtils');

async function listBackups(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const { serverUrl, appName } = options;
    const spinner = ora();

    try {
        await apiClient.ensureAuthenticated(serverUrl);

        spinner.start(`Fetching backups for '${appName}'...`);
        const result = await apiClient.listBackups(serverUrl, appName);
        
        if (result.status !== 'success' || !result.backups) {
            throw new Error(result.message || "Failed to retrieve backup list from server.");
        }
        
        spinner.stop();
        
        const backups = result.backups;
        if (backups.length === 0) {
            console.log(chalk.blueBright(`No backups found for application '${appName}'.`));
        } else {
            console.log(chalk.blueBright(`Available Backups for '${appName}' at ${serverUrl}:`));
            // Format for console.table
            const formattedBackups = backups.map(b => ({ 'Backup Filename': b }));
            console.table(formattedBackups);
        }

    } catch (err) {
        spinner.fail(chalk.bgRed('Failed to fetch backups.'));
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

module.exports = { listBackups };
