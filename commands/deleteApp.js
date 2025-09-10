const apiClient = require('./apiClient');
const { _readAppPreset, _validateAppPreset } = require('./installerUtils');

async function deleteApp(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const { default: inquirer } = await import('inquirer');
    const { serverUrl, appName, file: presetFilePath } = options;

    const spinner = ora();

    try {
        let confirmation = false;
        if (presetFilePath) {
            // --- NON-INTERACTIVE MODE ---
            console.log(chalk.blue(`Running in non-interactive mode using preset file: ${presetFilePath}`));
            const preset = _readAppPreset(presetFilePath);
            _validateAppPreset(preset, 'delete');
            confirmation = preset.delete.confirm; // This will be true if validation passed
        } else {
            const { confirmDelete } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'confirmDelete',
                    message: `This will ${chalk.bgRed('PERMANENTLY DELETE')} the application '${chalk.bgRed(appName)}' and all its content.\n  This action cannot be undone. To confirm, please type the name of the app:`
                }
            ]);
            if (confirmDelete === appName) {
                confirmation = true;
            } else {
                throw new Error('Confirmation text did not match. Deletion cancelled.');
            }
        }

        if (confirmation) {
            spinner.start(`Deleting app '${appName}'...`)
            const result = await apiClient.deleteApp(serverUrl, appName);

            if (result.status !== 'success') {
                throw new Error(result.message || 'Server responded with an unknown error.');
            }

            spinner.succeed(chalk.bgGreen(`✅ Success!`));
            console.log(chalk.blueBright(`App '${appName}' deleted from Gingee Server - ${serverUrl}`));
        } else {
            console.log(chalk.bgGreen(`Canceled: `), chalk.blueBright('Deletion cancelled. No changes made.'));
        }

    } catch (err) {
        spinner.fail(chalk.bgRed('Deletion failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = err.response ? (err.response.data.message || 'Server error.') : err.message;
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    }
}

module.exports = { deleteApp };
