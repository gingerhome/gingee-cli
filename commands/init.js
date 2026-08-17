const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const argon2 = require('argon2');
const { _unzipBuffer } = require('./installerUtils');
const {
  packagesForFeatures,
  resolveFeatureKeys,
  checkboxChoices
} = require('./optionalFeatures');

/**
 * @param {string} projectPath
 * @param {string[]} npmPackages
 * @param {object} spinner
 * @param {object} chalk
 */
function installProjectDependencies(projectPath, npmPackages, spinner, chalk) {
  // Always omit transitive optionals from gingee first (slim, resilient installs).
  spinner.start('Installing core dependencies (npm install --omit=optional)...');
  execSync('npm install --omit=optional', { cwd: projectPath, stdio: 'ignore' });
  spinner.succeed('Core dependencies installed.');

  if (npmPackages.length === 0) {
    return;
  }

  spinner.start(
    `Installing selected optional packages (${npmPackages.length}): ${npmPackages.join(', ')}...`
  );
  // Install as direct deps of the project so require() from gingee can resolve them.
  // Package names come from a fixed allowlist in optionalFeatures.js (not free-form user input).
  execSync(`npm install ${npmPackages.join(' ')}`, {
    cwd: projectPath,
    stdio: 'ignore'
  });
  spinner.succeed('Optional feature packages installed.');
}

async function init(projectName) {
  const { default: ora } = await import('ora');
  const { default: chalk } = await import('chalk');
  const { default: inquirer } = await import('inquirer');

  const spinner = ora();
  try {
    console.log(chalk.blueBright("🚀 Welcome to Gingee! Let's create your new project."));
    const projectPath = path.resolve(process.cwd(), projectName);

    let currentPath = process.cwd();
    while (currentPath !== path.parse(currentPath).root) {
      if (fs.existsSync(path.join(currentPath, 'gingee.json'))) {
        throw new Error(
          `Command cannot be run inside an existing Gingee project.\nDetected project root at: ${currentPath}`
        );
      }
      currentPath = path.dirname(currentPath);
    }

    if (fs.existsSync(projectPath)) {
      throw new Error(`Directory '${projectName}' already exists. Please choose another name.`);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'adminUser',
        message: 'Enter a username for the Glade admin panel:',
        default: 'admin'
      },
      {
        type: 'password',
        name: 'adminPass',
        message: 'Enter a password for the Glade admin:',
        mask: '*',
        validate: (input) => {
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
        mask: '*'
      },
      {
        type: 'list',
        name: 'depProfile',
        message:
          'Optional feature packages (image/sharp, SQL drivers other than SQLite, PDF, charts, SendGrid, Gemini):',
        default: 'recommended',
        choices: [
          {
            name: 'Minimal — core + SQLite only (fastest; no sharp / image; omit=optional style)',
            value: 'minimal'
          },
          {
            name: 'Recommended — image (sharp), PostgreSQL, PDF, charts, SendGrid, Gemini (good default)',
            value: 'recommended'
          },
          {
            name: 'Full — all optional packages (image, all SQL drivers, media, providers)',
            value: 'full'
          },
          {
            name: 'Custom — choose packages…',
            value: 'custom'
          }
        ]
      },
      {
        type: 'checkbox',
        name: 'customFeatures',
        message: 'Select optional features to install:',
        choices: checkboxChoices(),
        when: (a) => a.depProfile === 'custom',
        pageSize: 12
      },
      {
        type: 'confirm',
        name: 'installDeps',
        message: 'Install npm dependencies automatically?',
        default: true
      }
    ]);

    if (answers.adminPass !== answers.confirmPassword) {
      throw new Error('Passwords do not match. Please try again.');
    }

    if (!answers.adminPass) {
      throw new Error('Admin password cannot be empty.');
    }

    const featureKeys = resolveFeatureKeys(answers.depProfile, answers.customFeatures);
    const optionalPackages = packagesForFeatures(featureKeys);

    spinner.start('Scaffolding project files...');
    fs.mkdirSync(projectPath);
    const templatePath = path.join(__dirname, '..', 'templates');
    const projectTemplatePath = path.join(templatePath, 'project');
    fs.copySync(projectTemplatePath, projectPath);

    const pkgJsonPath = path.join(projectPath, 'package.json');
    const pkgJson = fs.readJsonSync(pkgJsonPath);
    pkgJson.name = projectName.toLowerCase().replace(/\s+/g, '-');
    // Record intended optionals as optionalDependencies on the app so reinstalls stay consistent.
    if (optionalPackages.length > 0) {
      pkgJson.optionalDependencies = pkgJson.optionalDependencies || {};
      for (const pkg of optionalPackages) {
        pkgJson.optionalDependencies[pkg] = '*';
      }
    }
    fs.writeJsonSync(pkgJsonPath, pkgJson, { spaces: 2 });
    fs.mkdirSync(path.join(projectPath, 'settings', 'ssl'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'backups'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'temp'), { recursive: true });

    spinner.succeed('Project files scaffolded.');
    spinner.start('Installing `glade` admin panel...');

    const gladeGinPath = path.join(templatePath, 'glade.gin');
    const gladePackageBuffer = fs.readFileSync(gladeGinPath);
    const gladeDestPath = path.join(projectPath, 'web', 'glade');

    await _unzipBuffer(gladePackageBuffer, gladeDestPath);
    spinner.succeed('`glade` admin panel installed.');
    spinner.start('Configuring admin credentials...');

    const passwordHash = await argon2.hash(answers.adminPass);
    const gladeAppConfigPath = path.join(gladeDestPath, 'box', 'app.json');
    const gladeAppConfig = fs.readJsonSync(gladeAppConfigPath);
    gladeAppConfig.env.ADMIN_USERNAME = answers.adminUser;
    gladeAppConfig.env.ADMIN_PASSWORD_HASH = passwordHash;
    fs.writeJsonSync(gladeAppConfigPath, gladeAppConfig, { spaces: 2 });
    spinner.succeed('Admin credentials configured securely.');

    spinner.start('Granting default permissions to Glade...');
    const permissionsFilePath = path.join(projectPath, 'settings', 'permissions.json');
    const permissionsConfig = {
      glade: {
        granted: ['platform', 'fs']
      }
    };
    fs.writeJsonSync(permissionsFilePath, permissionsConfig, { spaces: 2 });
    spinner.succeed('Default permissions for Glade configured.');

    if (answers.installDeps) {
      installProjectDependencies(projectPath, optionalPackages, spinner, chalk);
    }

    console.log(
      chalk.bgGreen('\n✅ Success!'),
      chalk.blueBright(`Your Gingee project "${projectName}" is ready.`)
    );
    console.log(`\nDependency profile: ${chalk.cyan(answers.depProfile)}`);
    if (optionalPackages.length) {
      console.log(
        chalk.blueBright('Optional packages:'),
        optionalPackages.join(', ')
      );
    } else {
      console.log(
        chalk.blueBright(
          'Optional packages: none (SQLite, console email, and mock AI work without extras; image needs sharp).'
        )
      );
    }

    console.log(`\nTo get started, run the following commands:\n`);
    console.log(chalk.blueBright(`  cd ${projectName}`));
    if (!answers.installDeps) {
      console.log(chalk.blueBright('  npm install --omit=optional'));
      if (optionalPackages.length) {
        console.log(chalk.blueBright(`  npm install ${optionalPackages.join(' ')}`));
      }
    }
    console.log(chalk.blueBright('  npm run start'));

    console.log(
      `\nAdd more features later with e.g. ${chalk.cyan('npm install sharp pg pdfmake')}`
    );
    console.log('(Missing optionals fail at use-time with FEATURE_NOT_INSTALLED.)\n');

    console.log(`\nFor production, you have two options:`);
    console.log(chalk.cyan('  1. Native Service: sudo gingee-cli service install'));
    console.log(chalk.cyan('  2. PM2:           pm2 start'));
    console.log(`     (Customize your PM2 deployment in ecosystem.config.js)`);
  } catch (err) {
    spinner.fail(chalk.bgRed('ERROR!: '));
    if (err.errors) {
      const messages = err.errors.map((e) => e.message).join('\n');
      console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${messages}`));
    } else {
      console.error(chalk.bgRed(`Error: `), chalk.blueBright(`${err.message}`));
    }
    process.exit(1);
  }
}

module.exports = { init, installProjectDependencies };
