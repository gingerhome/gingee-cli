// The command module will be required dynamically inside the tests.
const path = require('path');

describe('addApp.js - Integration Test', () => {

    let addApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // Important for re-requiring the module

        // Suppress console output for cleaner test results
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should scaffold a new MPA app with DB and JWT config based on user input', async () => {
        const appName = 'my-new-app';

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false),
            ensureDirSync: jest.fn(),
            writeJsonSync: jest.fn(),
            writeFileSync: jest.fn(),
        }));
        const fs = require('fs-extra');

        // Mock the utility functions that find the project root
        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));
        
        // Mock the user's answers for the interactive wizard
        const promptMock = jest.fn().mockResolvedValue({
            type: 'MPA',
            configureDb: true,
            dbType: 'postgres',
            dbName: 'main_db',
            dbHost: 'localhost',
            dbUser: 'testuser',
            dbPass: 'password',
            dbDatabase: 'testdb',
            configureJwt: true,
        });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        // --- DYNAMICALLY REQUIRE AND RUN ---
        addApp = require('../../commands/addApp').addApp;
        await addApp(appName);

        // --- ASSERTIONS ---
        const appPath = path.join('/fake/project/web', appName);
        const boxPath = path.join(appPath, 'box');
        
        // Verify directory structure is created
        expect(fs.ensureDirSync).toHaveBeenCalledWith(boxPath);
        expect(fs.ensureDirSync).toHaveBeenCalledWith(path.join(appPath, 'css'));
        expect(fs.ensureDirSync).toHaveBeenCalledWith(path.join(appPath, 'images'));
        expect(fs.ensureDirSync).toHaveBeenCalledWith(path.join(appPath, 'scripts'));

        // Verify app.json is written with the correct, combined configuration
        const appJsonCall = fs.writeJsonSync.mock.calls[0];
        expect(appJsonCall[0]).toBe(path.join(boxPath, 'app.json')); // Correct path
        expect(appJsonCall[1]).toHaveProperty('type', 'MPA');
        expect(appJsonCall[1]).toHaveProperty('jwt_secret'); // Check that a secret was generated
        expect(appJsonCall[1].db[0]).toEqual({
            type: 'postgres',
            name: 'main_db',
            host: 'localhost',
            user: 'testuser',
            password: 'password',
            database: 'testdb'
        });

        // Verify that boilerplate files were created
        expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(boxPath, 'hello.js'), expect.any(String));
        expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(appPath, 'index.html'), expect.any(String));
        expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(appPath, 'scripts', 'cl_app.js'), expect.any(String));
    });
    
    it('should fail if the app directory already exists', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true) // Simulate app exists
        }));
        
        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));

        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: jest.fn() } }));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        addApp = require('../../commands/addApp').addApp;

        // --- ASSERTIONS ---
        await expect(addApp('existing-app')).rejects.toThrow('process.exit: 1');
        expect(process.exit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });
});
