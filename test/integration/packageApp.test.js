const path = require('path');
const { PassThrough } = require('stream');

describe('packageApp.js - Integration Test', () => {

    let packageApp;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should call the package API and save the streamed response to a file', async () => {
        // --- MOCK DEPENDENCIES ---
        jest.unstable_mockModule('ora', () => ({ default: () => ({ start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis(), succeed: jest.fn().mockReturnThis(), info: jest.fn().mockReturnThis(), fail: jest.fn().mockReturnThis(), text: '' }) }));
        jest.unstable_mockModule('chalk', () => ({ default: { bgGreen: jest.fn(s => s), bgRed: jest.fn(s => s), bgBlue: jest.fn(s => s), bgYellow: jest.fn(s => s), green: jest.fn(s => s), blueBright: jest.fn(s => s), red: jest.fn(s => s), cyan: jest.fn(s => s) } }));

        // Mock the file stream response from the API
        const mockStream = new PassThrough();
        mockStream.write('fake-gin-data');
        mockStream.end();

        jest.mock('../../commands/apiClient', () => ({
            ensureAuthenticated: jest.fn().mockResolvedValue(true),
            packageApp: jest.fn().mockResolvedValue({
                data: mockStream,
                headers: {
                    'content-disposition': 'attachment; filename="my-app-v1.2.3.gin"'
                }
            })
        }));
        const apiClient = require('../../commands/apiClient');

        // Mock fs-extra to watch the file writing
        let writtenData = "";
        const mockWriteStream = new PassThrough();
        mockWriteStream.on("data", (chunk) => {
            writtenData += chunk.toString();
        });

        mockWriteStream.on("end", () => {
            // Verify the response stream was piped to the file writer
            expect(writtenData).toBe('fake-gin-data');
        });

        jest.mock('fs-extra', () => ({
            createWriteStream: jest.fn().mockReturnValue(mockWriteStream),
            ensureDirSync: jest.fn()
        }));
        const fs = require('fs-extra');

        // --- DYNAMICALLY REQUIRE AND RUN ---
        packageApp = require('../../commands/packageApp').packageApp;
        const options = {
            serverUrl: 'http://test.server',
            appName: 'my-app',
            dest: '/fake/dest/folder'
        };
        await packageApp(options);

        // --- ASSERTIONS ---
        // Verify the correct API was called
        expect(apiClient.packageApp).toHaveBeenCalledWith(options.serverUrl, options.appName);
        
        // Verify the destination directory was created
        expect(fs.ensureDirSync).toHaveBeenCalledWith(path.resolve(options.dest));
        
        // Verify a write stream was created for the correct file path
        expect(fs.createWriteStream).toHaveBeenCalledWith(path.join(path.resolve(options.dest), 'my-app-v1.2.3.gin'));
    });
});
