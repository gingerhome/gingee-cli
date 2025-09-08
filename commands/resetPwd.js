const fs = require('fs-extra');
const path = require('path');
const argon2 = require('argon2');
const { getProjectRoot, getWebRoot } = require('./utils');

async function resetPwd() {
    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');

    try {
        console.log(chalk.blueBright('Glade Admin Password Reset Utility'));

        const projectRoot = getProjectRoot();
        const webRoot = getWebRoot(projectRoot);
        const gladeAppPath = path.join(webRoot, 'glade');
        const gladeAppConfigPath = path.join(gladeAppPath, 'box', 'app.json');

        // Verify that the glade app and its config exist
        if (!fs.existsSync(gladeAppConfigPath)) {
            throw new Error("Could not find the `glade` application's app.json file. Is glade installed?");
        }

        // --- Run the interactive wizard ---
        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'newPassword',
                message: 'Enter the new password for the Glade admin:',
                mask: '*',
                validate: input => {
                    if (!input || input.length < 8) {
                        return 'Password must be at least 8 characters long.';
                    }
                    return true;
                }
            },
            {
                type: 'password',
                name: 'confirmPassword',
                message: 'Confirm the new password:',
                mask: '*',
            }
        ]);

        if (answers.newPassword !== answers.confirmPassword) {
            throw new Error("Passwords do not match. Please try again.");
        }

        console.log(chalk.blueBright('Hashing new password...'));
        
        // --- Hash the password ---
        const passwordHash = await argon2.hash(answers.newPassword);
        
        // --- Safely update app.json ---
        const appConfig = fs.readJsonSync(gladeAppConfigPath);
        
        // Ensure the env object exists
        if (!appConfig.env) {
            appConfig.env = {};
        }
        
        appConfig.env.ADMIN_PASSWORD_HASH = passwordHash;
        
        fs.writeJsonSync(gladeAppConfigPath, appConfig, { spaces: 2 });

        console.log(chalk.bgGreen(`\n✅ Success!`), chalk.blueBright(`The Glade admin password has been reset.`));
        console.log(chalk.blueBright(`   You can now log in with your new password.`));

    } catch (err) {
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            console.error(chalk.bgRed(`\nError: `), chalk.blueBright(`${err.message}`));
        }
        process.exit(1);
    }
}

module.exports = { resetPwd };
