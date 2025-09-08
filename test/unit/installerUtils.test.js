const { _resolveStoreUrl, _resolveDownloadUrl, _substituteEnvVars, _validateAppPreset } = require('../../commands/installerUtils');

describe('installerUtils.js - Unit Tests', () => {

    describe('_resolveStoreUrl', () => {
        it('should append gstore.json to a directory URL', () => {
            expect(_resolveStoreUrl('http://example.com/apps')).toBe('http://example.com/apps/gstore.json');
        });
        it('should append gstore.json to a directory URL with a trailing slash', () => {
            expect(_resolveStoreUrl('http://example.com/apps/')).toBe('http://example.com/apps/gstore.json');
        });
        it('should return the URL as is if it already points to gstore.json', () => {
            expect(_resolveStoreUrl('http://example.com/apps/gstore.json')).toBe('http://example.com/apps/gstore.json');
        });
        it('should throw an error for an incorrect filename', () => {
            expect(() => _resolveStoreUrl('http://example.com/apps/manifest.json')).toThrow('Invalid manifest filename');
        });
    });

    describe('_resolveDownloadUrl', () => {
        const storeUrl = 'http://example.com/apps/gstore.json';
        it('should return an absolute URL as is', () => {
            const absoluteUrl = 'https://cdn.com/package.gin';
            expect(_resolveDownloadUrl(storeUrl, absoluteUrl)).toBe(absoluteUrl);
        });
        it('should resolve a relative URL against the store URL', () => {
            const relativeUrl = 'packages/app.gin';
            expect(_resolveDownloadUrl(storeUrl, relativeUrl)).toBe('http://example.com/apps/packages/app.gin');
        });
    });

    describe('_substituteEnvVars', () => {
        beforeAll(() => {
            process.env.TEST_DB_PASS = 'secret123';
        });
        afterAll(() => {
            delete process.env.TEST_DB_PASS;
        });

        it('should substitute an environment variable placeholder', () => {
            const dbConfig = [{ password: '$TEST_DB_PASS', user: 'admin' }];
            const result = _substituteEnvVars(dbConfig);
            expect(result[0].password).toBe('secret123');
            expect(result[0].user).toBe('admin');
        });
        it('should throw an error for a missing environment variable', () => {
            const dbConfig = [{ password: '$MISSING_VAR' }];
            expect(() => _substituteEnvVars(dbConfig)).toThrow('Environment variable "MISSING_VAR" specified in the preset file is not set');
        });
    });
    
    describe('_validateAppPreset', () => {
        it('should not throw for a valid upgrade preset', () => {
            const preset = { upgrade: { consent: { grantPermissions: [] } } };
            expect(() => _validateAppPreset(preset, 'upgrade')).not.toThrow();
        });
        it('should throw if the action key is missing', () => {
            const preset = { rollback: {} };
            expect(() => _validateAppPreset(preset, 'upgrade')).toThrow('Preset file is missing the required top-level key for the "upgrade" action.');
        });
    });
});
