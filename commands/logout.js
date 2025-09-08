const { deleteSession } = require('./apiClient');

async function logout(options) {
    const { default: chalk } = await import('chalk');
    const { serverUrl = 'http://localhost:7070' } = options;
    deleteSession(serverUrl);
    console.log(chalk.bgGreen('✅ Logged out: '), chalk.blueBright(`You have been logged out from GingerJS Glade at - ${serverUrl}`));
}

module.exports = { logout };
