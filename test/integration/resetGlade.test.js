// The command module will be required dynamically inside the tests.
const { mkdir } = require('fs');
const path = require('path');

describe('resetGlade.js - Integration Test', () => {

    let resetGlade;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Mock require.resolve to prevent it from failing to find the real package
        jest.spyOn(require, 'resolve').mockReturnValue('/fake/path/to/glade.gin');
    });

    it('should delete, reinstall, and reconfigure glade after user confirmation', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.mock('fs-extra', () => ({
            mkdirSync: jest.fn(),
            existsSync: jest.fn().mockReturnValue(true), // Simulate glade exists
            removeSync: jest.fn(),
            readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-gin-buffer')),
            readJsonSync: jest.fn().mockReturnValue({ env: {} }), // Mock reading the newly installed app.json
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
        
        // Simulate a multi-step prompt
        const promptMock = jest.fn()
            .mockResolvedValueOnce({ confirmation: 'glade' }) // First, confirm deletion
            .mockResolvedValueOnce({ adminUser: 'newadmin', adminPass: 'newpass' }); // Second, get new creds
        jest.unstable_mockModule('inquirer', () => ({ default: { prompt: promptMock } }));

        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: jest.fn() }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s) }}));
        
        // Mock the internal unzip helper by mocking the module it's in
        jest.mock('../../commands/installerUtils', () => ({
            _unzipBuffer: jest.fn().mockResolvedValue(true),
        }));
        const mockUnzip = require('../../commands/installerUtils')._unzipBuffer;

        // --- DYNAMICALLY REQUIRE AND RUN ---
        resetGlade = require('../../commands/resetGlade').resetGlade;
        await resetGlade();

        // --- ASSERTIONS ---
        const gladeAppPath = path.join('/fake/project/web', 'glade');

        // Verify the user was prompted for deletion confirmation
        expect(promptMock).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({
            message: expect.stringContaining("PERMANENTLY DELETE")
        })]));

        // Verify the old directory was removed
        expect(fs.removeSync).toHaveBeenCalledWith(gladeAppPath);
        
        // Verify the glade.gin was "unzipped" to the correct path
        expect(mockUnzip).toHaveBeenCalledWith(Buffer.from('fake-gin-buffer'), gladeAppPath);
        
        // Verify the user was prompted for new credentials
        expect(promptMock).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ name: 'adminUser' })
        ]));
        
        // Verify the new password was hashed
        expect(argon2.hash).toHaveBeenCalledWith('newpass');
        
        // Verify the final, reconfigured app.json was written
        const writeCall = fs.writeJsonSync.mock.calls[0];
        expect(writeCall[0]).toBe(path.join(gladeAppPath, 'box', 'app.json'));
        expect(writeCall[1].env).toEqual({
            ADMIN_USERNAME: 'newadmin',
            ADMIN_PASSWORD_HASH: '$new_argon2_hash$'
        });
    });
});
