// The command module will be required dynamically inside the tests.
const path = require('path');

describe('resetPwd.js - Integration Test', () => {

    let resetPwd;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should hash a new password and correctly update glade/box/app.json', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true), // Simulate glade and its config exist
            readJsonSync: jest.fn().mockReturnValue({
                name: 'glade',
                env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$old_hash' }
            }),
            writeJsonSync: jest.fn(),
        }));
        const fs = require('fs-extra');

        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));
        
        jest.mock('argon2', () => ({
            hash: jest.fn().mockResolvedValue('$new_argon2_hash$'),
        }));
        const argon2 = require('argon2');

        const promptMock = jest.fn(() => Promise.resolve({
            newPassword: 'new-secure-password',
            confirmPassword: 'new-secure-password'
        }));
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        resetPwd = require('../../commands/resetPwd').resetPwd;
        await resetPwd();

        // --- ASSERTIONS ---
        const gladeAppConfigPath = path.join('/fake/project/web', 'glade', 'box', 'app.json');
        
        // Verify we read the original config
        expect(fs.readJsonSync).toHaveBeenCalledWith(gladeAppConfigPath);
        
        // Verify the new password was hashed
        expect(argon2.hash).toHaveBeenCalledWith('new-secure-password');
        
        // Verify we wrote the updated config back to the same file
        const writeCall = fs.writeJsonSync.mock.calls[0];
        expect(writeCall[0]).toBe(gladeAppConfigPath);
        expect(writeCall[1].env.ADMIN_PASSWORD_HASH).toBe('$new_argon2_hash$');
        expect(writeCall[1].env.ADMIN_USERNAME).toBe('admin'); // Ensure other env vars are preserved
    });
    
    it('should fail if passwords do not match', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            existsSync: jest.fn().mockReturnValue(true), // Simulate glade and its config exist
            readJsonSync: jest.fn().mockReturnValue({
                name: 'glade',
                env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$old_hash' }
            }),
            writeJsonSync: jest.fn(),
        }));
        const fs = require('fs-extra');
        jest.mock('../../commands/utils', () => ({
            getProjectRoot: jest.fn().mockReturnValue('/fake/project'),
            getWebRoot: jest.fn().mockReturnValue('/fake/project/web'),
        }));
        
        const promptMock = jest.fn(() => Promise.resolve({
            newPassword: 'new-secure-password',
            confirmPassword: 'mismatched-password'
        }));
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // --- DYNAMICALLY REQUIRE AND RUN ---
        resetPwd = require('../../commands/resetPwd').resetPwd;

        // --- ASSERTIONS ---
        await expect(resetPwd()).rejects.toThrow('process.exit: 1');
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error"), expect.stringContaining("Passwords do not match."));
        expect(process.exit).toHaveBeenCalledWith(1);
        
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
});
