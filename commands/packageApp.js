const apiClient = require('./apiClient');
const fs = require('fs-extra');
const path = require('path');
const { _getHttpClientErrorMessage } = require('./installerUtils');

async function packageApp(options) {
    const { default: chalk } = await import('chalk');
    const { default: ora } = await import('ora');
    const { serverUrl, appName, dest: destFolder } = options;
    const spinner = ora();

    try {
        await apiClient.ensureAuthenticated(serverUrl);

        spinner.start(`Requesting package for '${appName}' from server...`);
        // This returns a readable stream of the file being downloaded.
        const response = await apiClient.packageApp(serverUrl, appName);
        const fileStream = response.data;

        let fileName = `${appName}.gin`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length > 1) {
                fileName = fileNameMatch[1];
                spinner.info(`Server suggested filename: ${fileName}`);
            }
        }
        
        let destPathRoot = process.cwd(); // Default to the current working directory
        if (destFolder) {
            try {
                const userDest = path.resolve(destFolder);
                // fs-extra's ensureDirSync is like `mkdir -p`, safe to run even if it exists.
                fs.ensureDirSync(userDest); 
                destPathRoot = userDest;
            } catch (err) {
                spinner.warn(chalk.yellow(`Could not create or access destination folder '${destFolder}'. Falling back to the current directory.`));
            }
        }
        const finalDestPath = path.join(destPathRoot, fileName);
        const writer = fs.createWriteStream(finalDestPath);
        
        spinner.text = `Downloading package to ${fileName}...`;

        // Pipe the download stream to the file writer stream.
        fileStream.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        spinner.succeed(chalk.bgGreen(`✅ Success!`), chalk.blueBright(`Application '${appName}' packaged to:`));
        console.log(chalk.cyan(`   ${finalDestPath}`));

    } catch (err) {
        spinner.fail(chalk.bgRed('Packaging failed.'));
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

module.exports = { packageApp };
