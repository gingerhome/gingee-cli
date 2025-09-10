// The command module will be required dynamically inside the tests.
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { mkdir } = require('fs');

describe('logout.js - Integration Test', () => {

    let logout;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should find and remove the correct session file if it exists', async () => {
        const serverUrl = 'http://test.server:7070';

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            mkdirSync: jest.fn(),
            existsSync: jest.fn().mockReturnValue(true), // Simulate session file exists
            removeSync: jest.fn(),
        }));
        const fs = require('fs-extra');

        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        logout = require('../../commands/logout').logout;
        await logout({ serverUrl });

        // --- ASSERTIONS ---
        const expectedHash = crypto.createHash('sha256').update(serverUrl).digest('hex');
        const expectedPath = path.join(os.homedir(), '.gingee', 'sessions', `${expectedHash}.json`);

        // Verify it checked for the file
        expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
        // Verify it removed the file
        expect(fs.removeSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should do nothing if the session file does not exist', async () => {
        const serverUrl = 'http://test.server:7070';

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            mkdirSync: jest.fn(),
            existsSync: jest.fn().mockReturnValue(false), // Simulate session file does NOT exist
            removeSync: jest.fn(),
        }));
        const fs = require('fs-extra');
        
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        logout = require('../../commands/logout').logout;
        await logout({ serverUrl });

        // --- ASSERTIONS ---
        // Verify it checked for the file
        expect(fs.existsSync).toHaveBeenCalledTimes(2); //first for sessions folder and then for session file
        // Verify remove was NOT called
        expect(fs.removeSync).not.toHaveBeenCalled();
    });
});
