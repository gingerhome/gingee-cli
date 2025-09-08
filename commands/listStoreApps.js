const axios = require('axios');
const {_resolveStoreUrl, _getHttpClientErrorMessage} = require('./installerUtils');

async function listStoreApps(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');

    const { gStoreUrl } = options;

    let resolvedUrl;
    try {
        // Resolve the URL before doing anything else.
        resolvedUrl = _resolveStoreUrl(gStoreUrl);
    } catch (err) {
        // This will catch errors from our resolver (e.g., invalid filename) or the URL constructor.
        console.error(chalk.bgRed(`Error: `), chalk.blueBright(err.message));
        process.exit(1);
    }

    const spinner = ora(`Fetching app store manifest from ${resolvedUrl}...`).start();

    try {
        const response = await axios.get(resolvedUrl);
        const manifest = response.data;

        if (!manifest || !Array.isArray(manifest.apps)) {
            throw new Error('Invalid or missing "apps" array in the gstore.json manifest.');
        }

        spinner.succeed(chalk.bgGreen(`Successfully fetched manifest for: ${manifest.storeName}`));

        const appData = manifest.apps.map(app => ({
            Name: app.name,
            Version: app.version,
            Publisher: app.publisher ? app.publisher.name : 'N/A',
            Description: app.description
        }));

        if (appData.length === 0) {
            console.log(chalk.yellow('No applications found in this store.'));
        } else {
            console.table(appData);
        }

    } catch (err) {
        spinner.fail(chalk.bgRed('Failed to fetch store manifest.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else if(err.response && err.response.status === 404) {
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`Store not found at ${resolvedUrl}. Please check the URL and try again.`));
        } else {
            const message = _getHttpClientErrorMessage(err);
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    }
}

module.exports = { listStoreApps };
