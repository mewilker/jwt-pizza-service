const request = require('supertest');
const app = require('../../src/service');

jest.mock('../../src/version.json', () => ({ version: '1.0.0' }));
jest.mock('../../src/config.js', () => ({
    factory: { url: 'http://factory.local' },
    db: { connection: { host: 'localhost' } },
}));

    describe('GET /', () => {
        it('should return welcome message and version', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('welcome to JWT Pizza');
            expect(res.body.version).toBe('1.0.0');
        });
    });

    describe('GET /api/docs', () => {
        it('should return API documentation', async () => {
            const res = await request(app).get('/api/docs');
            expect(res.status).toBe(200);
            expect(res.body.version).toBe('1.0.0');
            expect(res.body.endpoints).toBeDefined();
        });
    });

    describe('Unknown endpoints', () => {
        it('should return 404 for unknown route', async () => {
            const res = await request(app).get('/unknown');
            expect(res.status).toBe(404);
            expect(res.body.message).toBe('unknown endpoint');
        });
    });

    describe('CORS headers', () => {
        it('should set CORS headers on all requests', async () => {
            const res = await request(app).get('/');
            expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE');
            expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });