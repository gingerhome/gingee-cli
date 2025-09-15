const apiClient = require('./apiClient');

async function listApps(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const spinner = ora();

    try {
        const { serverUrl = 'http://localhost:7070' } = options;

        await apiClient.ensureAuthenticated(serverUrl);

        spinner.start('Fetching installed applications...');
        
        const { client } = await apiClient.getAuthenticatedClient(serverUrl);
        const response = await client.get(`${serverUrl}/glade/api/apps`);
        
        if (response.data.status !== 'success' || !response.data.apps) {
            throw new Error("Failed to retrieve app list from server.");
        }
        
        spinner.stop(); // Stop the spinner before printing the table
        
        const apps = response.data.apps;
        if (apps.length === 0) {
            console.log(chalk.yellow('No applications are currently installed.'));
        } else {
            console.log(chalk.blueBright(`Installed Applications at Gingee Server : ${serverUrl}`));
            console.table(apps);
        }

    } catch (err) {
        spinner.fail(chalk.bgRed('Error!'));
        console.error(chalk.blueBright(`Failed to fetch apps.`));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = err.response ? (err.response.data.error || 'Server error.') : err.message;
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    }
}

module.exports = { listApps };
