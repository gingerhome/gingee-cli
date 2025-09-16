const fs = require('fs-extra');
const path = require('path');
const argon2 = require('argon2');
const { getProjectRoot, getWebRoot } = require('./utils');
const { _unzipBuffer } = require('./installerUtils');

async function resetGlade() {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');
    const { default: ora } = await import('ora');
    const spinner = ora();

    try {
        console.log(chalk.blueBright('⚠️  Glade Admin Panel Install/Reset Utility  ⚠️'));

        const projectRoot = getProjectRoot();
        const webRoot = getWebRoot(projectRoot);
        const gladeAppPath = path.join(webRoot, 'glade');

        // --- THIS IS THE NEW, MORE ROBUST LOGIC ---
        if (fs.existsSync(gladeAppPath)) {
            // If the folder exists, we are in "reset" mode. We need confirmation.
            const { confirmation } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'confirmation',
                    message: `This will ${chalk.bgRed('PERMANENTLY DELETE')} the existing 'glade' application and reinstall it.\n  To confirm, please type the name of the app ('glade'):`,
                }
            ]);

            if (confirmation !== 'glade') {
                console.log(chalk.yellow('Reset cancelled. No changes were made.'));
                return;
            }

            // Deletion
            spinner.start('Deleting current `glade` installation...');
            fs.removeSync(gladeAppPath);
            spinner.succeed('Current `glade` installation deleted.');
        }
        // --- END OF NEW LOGIC ---
        // If the folder didn't exist, we just proceed directly to installation.

        // --- Re-installation ---
        spinner.start('Installing a clean version of `glade`...');
        const templatePath = path.join(__dirname, '..', 'templates');
        const gladeGinPath = path.join(templatePath, 'glade.gin');
        const gladePackageBuffer = fs.readFileSync(gladeGinPath);
        await _unzipBuffer(gladePackageBuffer, gladeAppPath);
        spinner.succeed('Clean `glade` version installed.');

        // --- Re-configuration (Wizard runs in both cases) ---
        console.log(chalk.blueBright('\nPlease set the administrator credentials.'));
        const newCreds = await inquirer.prompt([
            { type: 'input', name: 'adminUser', message: 'Enter a username for the Glade admin panel:', default: 'admin' },
            { type: 'password', name: 'adminPass', message: 'Enter a password for the Glade admin:', mask: '*' },
        ]);

        if (!newCreds.adminPass) {
            throw new Error("Admin password cannot be empty.");
        }

        spinner.start('Configuring admin credentials...');
        const passwordHash = await argon2.hash(newCreds.adminPass);
        const gladeAppConfigPath = path.join(gladeAppPath, 'box', 'app.json');
        const gladeAppConfig = fs.readJsonSync(gladeAppConfigPath);
        gladeAppConfig.env.ADMIN_USERNAME = newCreds.adminUser;
        gladeAppConfig.env.ADMIN_PASSWORD_HASH = passwordHash;
        fs.writeJsonSync(gladeAppConfigPath, gladeAppConfig, { spaces: 2 });
        spinner.succeed('Admin credentials configured securely.');

        spinner.start('Granting default permissions to Glade...');
        const permissionsFilePath = path.join(projectRoot, 'settings', 'permissions.json');
        const permissionsConfig = {
            "glade": {
                "granted": ["platform", "fs"]
            }
        };
        fs.writeJsonSync(permissionsFilePath, permissionsConfig, { spaces: 2 });
        spinner.succeed('Default permissions for Glade configured.');

        console.log(chalk.bgGreen(`\n✅ Success!`), chalk.blueBright(`The 'glade' admin panel is ready.`));

    } catch (err) {
        spinner.fail(chalk.bgRed('Operation failed.'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            console.error(chalk.bgRed(`\nError: `), chalk.blueBright(`${err.message}`));
        }
        process.exit(1);
    }
}

module.exports = { resetGlade };
