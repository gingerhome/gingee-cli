// The command module will be required dynamically inside the tests.
const path = require('path');

// --- MOCK ALL EXTERNAL DEPENDENCIES ---
jest.mock('child_process');

// A more direct way to mock require.resolve
jest.spyOn(require, 'resolve').mockReturnValue(path.resolve('/fake/cli/node_modules/gingerjs/templates/glade.gin'));


describe('init.js - Integration Test', () => {

    let init; // To hold the dynamically required function

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // Important for re-requiring the module

        jest.unstable_mockModule('ora', () => ({
            default: function () {
                return {
                    start: jest.fn().mockReturnThis(),
                    stop: jest.fn().mockReturnThis(),
                    succeed: jest.fn().mockReturnThis(),
                    fail: jest.fn().mockReturnThis(),
                };
            }
        }));

        jest.unstable_mockModule('chalk', () => ({
            default: { bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgGreen: jest.fn(s => s), blueBright: jest.fn(s => s), green: jest.fn(s => s), red: jest.fn(s => s), yellow: jest.fn(s => s), cyan: jest.fn(s => s) }
        }));

        // Suppress console output for cleaner test results
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('should successfully scaffold a new project and install dependencies', async () => {
        const projectName = 'my-test-project';

        jest.mock('child_process', () => ({
            execSync: jest.fn((cmd) => {
                console.log(`Mocked execSync called with: ${cmd}`);
                return true;
            }),
        }));
        const {execSync} = require('child_process');

        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false),
            readJsonSync: jest.fn((path) => {
                if (path.includes('package.json')) {
                    return { name: 'template-pkg' };
                }else if(path.includes('app.json')){
                    return { env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$fake-argon2-hash$' } };
                }
                throw new Error('File not found');
            }),
            readFileSync: jest.fn(() => {
                return Buffer.from('fake-gin-file');
            }),
            mkdirSync: jest.fn().mockReturnValue(true),
            copySync: jest.fn().mockReturnValue(true),
            writeJsonSync: jest.fn().mockReturnValue(true),
        }));
        const fs = require('fs-extra');

        jest.mock('argon2', () => ({
            hash: jest.fn().mockResolvedValue('$fake-argon2-hash$'),
        }));
        const argon2 = require('argon2');

        const promptMock = jest.fn(() => Promise.resolve({
            adminUser: 'admin',
            adminPass: 'password123',
            confirmPassword: 'password123',
            installDeps: true
        }));

        jest.unstable_mockModule('inquirer', () => ({
            default: {
                prompt: promptMock
            },
        }));

        jest.mock('../../commands/installerUtils', () => ({
            _unzipBuffer: jest.fn().mockResolvedValue(true),
        }));
        _unzipBuffer = require('../../commands/installerUtils')._unzipBuffer;

        init = require('../../commands/init').init;
        await init(projectName);

        // --- ASSERT ---
        // Verify project directory is created
        const projectPath = path.resolve(process.cwd(), projectName);
        expect(fs.mkdirSync).toHaveBeenCalledWith(projectPath);

        // Verify template is copied
        expect(fs.copySync).toHaveBeenCalled();

        // Verify package.json is updated with the project name
        expect(fs.writeJsonSync).toHaveBeenCalledWith(
            expect.stringContaining('package.json'),
            expect.objectContaining({ name: projectName }),
            expect.any(Object)
        );

        // Verify Glade was "unzipped"
        expect(_unzipBuffer).toHaveBeenCalled();

        // Verify password was hashed
        expect(argon2.hash).toHaveBeenCalledWith('password123');

        // Verify glade's app.json was updated with credentials
        expect(fs.writeJsonSync).toHaveBeenCalledWith(
            expect.stringContaining(path.join('glade', 'box', 'app.json')),
            expect.objectContaining({
                env: {
                    ADMIN_USERNAME: 'admin',
                    ADMIN_PASSWORD_HASH: '$fake-argon2-hash$'
                }
            }),
            expect.any(Object)
        );

        // Verify npm install was called
        expect(execSync).toHaveBeenCalledWith('npm install', { cwd: expect.any(String), stdio: 'ignore' });
    });

    it('should scaffold a project but skip dependency installation if user declines', async () => {
        const projectName = 'my-test-project';

        jest.mock('child_process', () => ({
            execSync: jest.fn((cmd) => {
                console.log(`Mocked execSync called with: ${cmd}`);
                return true;
            }),
        }));
        const {execSync} = require('child_process');

        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false),
            readJsonSync: jest.fn((path) => {
                if (path.includes('package.json')) {
                    return { name: 'template-pkg' };
                }else if(path.includes('app.json')){
                    return { env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$fake-argon2-hash$' } };
                }
                throw new Error('File not found');
            }),
            readFileSync: jest.fn(() => {
                return Buffer.from('fake-gin-file');
            }),
            mkdirSync: jest.fn().mockReturnValue(true),
            copySync: jest.fn().mockReturnValue(true),
            writeJsonSync: jest.fn().mockReturnValue(true),
        }));
        const fs = require('fs-extra');

        jest.mock('argon2', () => ({
            hash: jest.fn().mockResolvedValue('$fake-argon2-hash$'),
        }));
        const argon2 = require('argon2');

        const promptMock = jest.fn(() => Promise.resolve({
            adminUser: 'admin',
            adminPass: 'password123',
            confirmPassword: 'password123',
            installDeps: false
        }));

        jest.unstable_mockModule('inquirer', () => ({
            default: {
                prompt: promptMock
            },
        }));

        jest.mock('../../commands/installerUtils', () => ({
            _unzipBuffer: jest.fn().mockResolvedValue(true),
        }));
        _unzipBuffer = require('../../commands/installerUtils')._unzipBuffer;

        init = require('../../commands/init').init;
        await init(projectName);

        // --- ASSERT ---
        // Verify npm install was NOT called
        expect(execSync).not.toHaveBeenCalled();
    });

    it('should fail if the project directory already exists', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true) //simulate project directory exists condition
        }));
        const fs = require('fs-extra');

        init = require('../../commands/init').init;
        await expect(init('existing-project')).rejects.toThrow('process.exit: 1');

        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining("Directory 'existing-project' already exists."));
        expect(mockExit).toHaveBeenCalledWith(1);

        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
