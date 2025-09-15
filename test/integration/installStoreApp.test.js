// Do NOT require the command at the top level.
const axios = require('axios');

describe('installStoreApp.js - Integration Test', () => {

    let installStoreApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // This is crucial to allow re-requiring the module

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

        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('should perform a full installation and succeed', async () => {
        jest.mock('../../commands/installerUtils', () => ({
            _resolveStoreUrl: jest.fn().mockReturnValue('http://fakestore.com/gstore.json'),
            _resolveDownloadUrl: jest.fn().mockReturnValue('http://example.com/apps/my-app.gin'),
            _unzipBuffer: jest.fn().mockResolvedValue(true),
            _repackApp: jest.fn().mockResolvedValue(Buffer.from('repacked-gin-buffer')),
            _getPermissions: jest.fn().mockResolvedValue(['db', 'fs']),
            _getDbRequirements: jest.fn().mockResolvedValue([{ host: 'db.prod' }]),
            _getHttpClientErrorMessage: jest.fn(err => err.message), // Simple mock for error messages
        }));
        const installerUtils = require('../../commands/installerUtils');

        jest.mock('axios', () => ({
            get: jest.fn((url) => {
                if (url === 'http://fakestore.com/gstore.json') {
                    return Promise.resolve({ data: { apps: [{ name: 'my-app', installName: 'my-app' }] } });
                }
                if (url === 'http://example.com/apps/my-app.gin') {
                    return Promise.resolve({ data: Buffer.from('fake-gin-buffer') });
                }
                return Promise.reject(new Error('Not Found'));
            })
        }));

        jest.mock('fs-extra', () => ({
            ensureDir: jest.fn().mockResolvedValue(true),
            remove: jest.fn().mockResolvedValue(true),
            readJson: jest.fn().mockResolvedValue({}),
            writeJson: jest.fn(() => {
                return Promise.resolve(true);
            }),
        }));
        const fs = require('fs-extra');


        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            installApp: jest.fn(() => {
                return Promise.resolve({ status: 'success' });
            })
        }));
        let apiClient = require('../../commands/apiClient');

        installStoreApp = require('../../commands/installStoreApp').installStoreApp;

        // --- RUN THE COMMAND ---
        await installStoreApp('my-app', { gStoreUrl: 'http://fakestore.com/', serverUrl: 'http://gingee.server' });
        await new Promise(process.nextTick);

        // --- ASSERTIONS ---
        expect(apiClient.installApp).toHaveBeenCalledTimes(1);
        expect(apiClient.installApp).toHaveBeenCalledWith(
            'http://gingee.server',
            'my-app',
            'my-app.gin',
            Buffer.from('repacked-gin-buffer'),
            ['db', 'fs']
        );

        const writtenAppJson = fs.writeJson.mock.calls[0][1];
        expect(writtenAppJson.db[0].host).toBe('db.prod');
    });

    it('should call process.exit(1) on failure', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`);
        });

        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            installApp: jest.fn(() => {
                return Promise.reject(new Error('Server is offline'));
            })
        }));
        let apiClient = require('../../commands/apiClient');

        // Provide return values for the steps that happen before the failure
        jest.mock('../../commands/installerUtils', () => ({
            _resolveStoreUrl: jest.fn().mockReturnValue('http://fakestore.com/gstore.json'),
            _resolveDownloadUrl: jest.fn().mockReturnValue('http://example.com/apps/my-app.gin'),
            _unzipBuffer: jest.fn().mockResolvedValue(true),
            _repackApp: jest.fn().mockResolvedValue(Buffer.from('repacked-gin-buffer')),
            _getPermissions: jest.fn().mockResolvedValue(['db']),
            _getDbRequirements: jest.fn().mockResolvedValue([]),
            _getHttpClientErrorMessage: jest.fn(err => err.message), // Simple mock for error messages
        }));
        const installerUtils = require('../../commands/installerUtils');

        jest.mock('axios', () => ({
            get: jest.fn((url) => {
                if (url === 'http://fakestore.com/gstore.json') {
                    return Promise.resolve({ data: { apps: [{ name: 'my-app' }] } });
                }
                if (url === 'http://example.com/apps/my-app.gin') {
                    return Promise.resolve({ data: Buffer.from('fake-gin-buffer') });
                }
                return Promise.reject(new Error('Not Found'));
            })
        }));

        jest.mock('fs-extra', () => ({
            ensureDir: jest.fn().mockResolvedValue(true),
            remove: jest.fn().mockResolvedValue(true),
            readJson: jest.fn(() => {
                return Promise.resolve({ db: [] });
            }),
            writeJson: jest.fn().mockResolvedValue(true),
        }));
        const fs = require('fs-extra');

        installStoreApp = require('../../commands/installStoreApp').installStoreApp;

        // --- RUN AND ASSERT ---
        await expect(installStoreApp('my-app', { gStoreUrl: 'http://fakestore.com/', serverUrl: 'http://gingee.server' }))
            .rejects.toThrow('process.exit: 1');

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });
});
