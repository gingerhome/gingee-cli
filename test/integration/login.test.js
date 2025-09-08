// The command module will be required dynamically inside the tests.
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exists } = require('../../../gingerjs/build/dist/gingerjs/modules/fs');
const { mkdir, mkdirSync } = require('fs');

describe('login.js - Integration Test', () => {

    let login;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should authenticate, receive a cookie, and save the session file', async () => {
        const serverUrl = 'http://test.server:7070';
        const sessionCookie = 'sessionId=abc123xyz789; HttpOnly; Secure';

        // --- MOCK DEPENDENCIES ---
        jest.mock('axios', () => ({
            post: jest.fn().mockResolvedValue({
                data: { status: 'success' },
                headers: { 'set-cookie': [sessionCookie] }
            })
        }));
        const axios = require('axios');

        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(false),
            mkdirSync: jest.fn(),
            ensureDirSync: jest.fn(),
            writeJsonSync: jest.fn(),
        }));
        const fs = require('fs-extra');
        
        const promptMock = jest.fn().mockResolvedValue({ username: 'admin', password: 'password123' });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        login = require('../../commands/login').login;
        await login({ serverUrl }); // Pass options object

        // --- ASSERTIONS ---

        // Verify authentication request was made
        expect(axios.post).toHaveBeenCalledWith(
            `${serverUrl}/glade/login`,
            { username: 'admin', password: 'password123' }
        );
        
        // Verify session directory was ensured
        const configDir = path.join(os.homedir(), '.gingerjs');
        expect(fs.ensureDirSync).toHaveBeenCalledWith(configDir);
        
        // Verify session file was written with correct content
        const writeCall = fs.writeJsonSync.mock.calls[0];
        const expectedHash = crypto.createHash('sha256').update(serverUrl).digest('hex');
        const credsPath = path.join(configDir, 'sessions', `${expectedHash}.json`);
        expect(writeCall[0]).toBe(credsPath); // Correct path
        expect(writeCall[1]).toEqual({
            serverUrl: serverUrl,
            cookie: 'sessionId=abc123xyz789' // Should only save the key-value part
        });
    });

    it('should fail gracefully if authentication fails', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- MOCK DEPENDENCIES ---
        jest.mock('axios', () => ({
            post: jest.fn().mockRejectedValue({
                response: { data: { message: 'Invalid credentials.' } }
            })
        }));

        const promptMock = jest.fn().mockResolvedValue({ username: 'admin', password: 'wrongpassword' });
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        login = require('../../commands/login').login;
        
        // --- ASSERTIONS ---
        await expect(login({ serverUrl: 'http://test.server:7070' })).rejects.toThrow('process.exit: 1');
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining('Invalid credentials.'));
        mockExit.mockRestore();
    });
});
