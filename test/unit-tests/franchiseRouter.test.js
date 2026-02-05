const request = require('supertest');
const express = require('express');
const franchiseRouter = require('../../src/routes/franchiseRouter');
const { DB, Role } = require('../../src/database/database');
const { StatusCodeError } = require('../../src/endpointHelper');

jest.mock('../../src/database/database');
jest.mock('../../src/routes/authRouter', () => ({
    authRouter: {
        authenticateToken: (req, res, next) => {
            req.user = { id: 1, isRole: jest.fn(() => false) };
            next();
        },
    },
}));

let app;

beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/franchise', franchiseRouter);
    jest.clearAllMocks();
});

describe('GET /', () => {
    test('should return franchises with pagination', async () => {
        const mockFranchises = [{ id: 1, name: 'pizzaPocket' }];
        DB.getFranchises.mockResolvedValue([mockFranchises, true]);

        const res = await request(app)
            .get('/api/franchise')
            .query({ page: 0, limit: 10, name: 'pizza' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ franchises: mockFranchises, more: true });
        expect(DB.getFranchises).toHaveBeenCalledWith(undefined, '0', '10', 'pizza');
    });
});

describe('GET /:userId', () => {
    test('should return user franchises when authenticated', async () => {
        const mockFranchises = [{ id: 1, name: 'pizzaPocket' }];
        DB.getUserFranchises.mockResolvedValue(mockFranchises);

        const res = await request(app)
            .get('/api/franchise/1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockFranchises);
        expect(DB.getUserFranchises).toHaveBeenCalledWith(1);
    });

    test('should return empty array when user id does not match and not admin', async () => {
        const res = await request(app)
            .get('/api/franchise/2');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
        expect(DB.getUserFranchises).not.toHaveBeenCalled();
    });
});

describe('POST /', () => {
    test('should create franchise when user is admin', async () => {
        const mockFranchise = { id: 1, name: 'pizzaPocket' };
        DB.createFranchise.mockResolvedValue(mockFranchise);

        app.use((req, res, next) => {
            req.user = { id: 1, isRole: jest.fn(() => true) };
            next();
        });
        app.use('/api/franchise', franchiseRouter);

        const res = await request(app)
            .post('/api/franchise')
            .send({ name: 'pizzaPocket', admins: [] });

        expect(res.status).toBe(200);
        expect(DB.createFranchise).toHaveBeenCalled();
    });

    test('should return 403 when user is not admin', async () => {
        const res = await request(app)
            .post('/api/franchise')
            .send({ name: 'pizzaPocket' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /:franchiseId', () => {
    test('should delete franchise', async () => {
        DB.deleteFranchise.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/franchise/1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'franchise deleted' });
        expect(DB.deleteFranchise).toHaveBeenCalledWith(1);
    });
});

describe('POST /:franchiseId/store', () => {
    test('should create store when user is franchise admin', async () => {
        const mockFranchise = { id: 1, admins: [{ id: 1 }] };
        const mockStore = { id: 1, name: 'SLC', totalRevenue: 0 };
        DB.getFranchise.mockResolvedValue(mockFranchise);
        DB.createStore.mockResolvedValue(mockStore);

        const res = await request(app)
            .post('/api/franchise/1/store')
            .send({ name: 'SLC' });

        expect(res.status).toBe(200);
        expect(DB.createStore).toHaveBeenCalledWith(1, { name: 'SLC' });
    });

    test('should return 403 when franchise does not exist', async () => {
        DB.getFranchise.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/franchise/1/store')
            .send({ name: 'SLC' });

        expect(res.status).toBe(403);
    });

    test('should return 403 when user is not franchise admin', async () => {
        const mockFranchise = { id: 1, admins: [{ id: 2 }] };
        DB.getFranchise.mockResolvedValue(mockFranchise);

        const res = await request(app)
            .post('/api/franchise/1/store')
            .send({ name: 'SLC' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /:franchiseId/store/:storeId', () => {
    test('should delete store when user is franchise admin', async () => {
        const mockFranchise = { id: 1, admins: [{ id: 1 }] };
        DB.getFranchise.mockResolvedValue(mockFranchise);
        DB.deleteStore.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/franchise/1/store/1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'store deleted' });
        expect(DB.deleteStore).toHaveBeenCalledWith(1, 1);
    });

    test('should return 403 when franchise does not exist', async () => {
        DB.getFranchise.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/franchise/1/store/1');

        expect(res.status).toBe(403);
    });
});
