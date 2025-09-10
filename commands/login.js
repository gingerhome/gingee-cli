const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { getCredsFilePath } = require('./apiClient');

const configDir = path.join(os.homedir(), '.gingee');

async function login(options = {}) {
    let { serverUrl = 'http://localhost:7070', username = 'admin', password } = options;
    const credsPath = getCredsFilePath(serverUrl);

    const { default: chalk } = await import('chalk');
    const { default: inquirer } = await import('inquirer');
    const { default: ora } = await import('ora');
    const spinner = ora();

    try {
        console.log(chalk.blueBright(`Logging into Glade admin panel at: ${serverUrl}`));
        if(!username || !password) {
            ({ username, password } = await inquirer.prompt([
                { type: 'input', name: 'username', message: 'Username:', default: 'admin' },
                { type: 'password', name: 'password', message: 'Password:', mask: '*' }
            ]));
        }

        spinner.start('Authenticating...');

        const response = await axios.post(`${serverUrl}/glade/login`, { username, password });

        if (response.data.status !== 'success') {
            throw new Error('Authentication failed. Please check your credentials.');
        }

        // Read the 'set-cookie' header directly from the response.
        const setCookieHeader = response.headers['set-cookie'];
        if (!setCookieHeader || setCookieHeader.length === 0) {
            throw new Error('Login succeeded, but the server did not send a session cookie.');
        }

        // The header can be an array of cookies. We are interested in our 'sessionId'.
        // We take the first part of the cookie string, before the attributes (HttpOnly, etc.)
        const sessionCookie = setCookieHeader
            .find(c => c.startsWith('sessionId='))
            .split(';')[0];

        if (!sessionCookie) {
            throw new Error('Could not find a valid sessionId cookie in the server response.');
        }

        // Save this definitive cookie string to the credentials file.
        fs.ensureDirSync(configDir);
        fs.writeJsonSync(credsPath, { serverUrl, cookie: sessionCookie });

        const successMsg = chalk.bgGreen('Success') + chalk.blueBright(` Logged in. Session saved.`);
        spinner.succeed(successMsg);
    } catch (err) {
        spinner.fail(chalk.bgRed('Error: '), chalk.blueBright('Login failed!'));
        if (err.errors) { //for AggregateError
            const messages = err.errors.map(e => e.message).join('\n');
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
        } else {
            const message = err.response ? (err.response.data.message || 'Invalid credentials.') : err.message;
            console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${message}`));
        }
        process.exit(1);
    }
}

module.exports = { login };
