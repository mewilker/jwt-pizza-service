const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authRouter, setAuthUser, setAuth } = require('../../src/routes/authRouter');
const { DB, Role } = require('../../src/database/database');
const config = require('../../src/config');

//vscode debugger timeout
if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

jest.mock('../../src/database/database');

let app;

beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(setAuthUser);
    app.use('/api/auth', authRouter);
    jest.clearAllMocks();
});

describe('POST /api/auth - Register', () => {
    it('should register a new user with valid credentials', async () => {
        const newUser = { id: 1, name: 'test user', email: 'test@jwt.com', roles: [{ role: Role.Diner }] };
        DB.addUser.mockResolvedValue(newUser);
        DB.loginUser.mockResolvedValue();

        const res = await request(app)
            .post('/api/auth')
            .send({ name: 'test user', email: 'test@jwt.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual(newUser);
        expect(res.body.token).toBeDefined();
    });

    it('should return 400 if name is missing', async () => {
        const res = await request(app)
            .post('/api/auth')
            .send({ email: 'test@jwt.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
    });

    it('should return 400 if email is missing', async () => {
        const res = await request(app)
            .post('/api/auth')
            .send({ name: 'test user', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
    });

    it('should return 400 if password is missing', async () => {
        const res = await request(app)
            .post('/api/auth')
            .send({ name: 'test user', email: 'test@jwt.com' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('name, email, and password are required');
    });
});

describe('PUT /api/auth - Login', () => {
    it('should login user with valid credentials', async () => {
        const user = { id: 1, name: 'test user', email: 'test@jwt.com', roles: [{ role: Role.Diner }] };
        DB.getUser.mockResolvedValue(user);
        DB.loginUser.mockResolvedValue();

        const res = await request(app)
            .put('/api/auth')
            .send({ email: 'test@jwt.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual(user);
        expect(res.body.token).toBeDefined();
    });

    it('should call DB.getUser with email and password', async () => {
        const user = { id: 1, name: 'test user', email: 'test@jwt.com', roles: [{ role: Role.Diner }] };
        DB.getUser.mockResolvedValue(user);
        DB.loginUser.mockResolvedValue();

        await request(app)
            .put('/api/auth')
            .send({ email: 'test@jwt.com', password: 'password123' });

        expect(DB.getUser).toHaveBeenCalledWith('test@jwt.com', 'password123');
    });

    it('should return 400 if email is missing', async () => {
        const res = await request(app)
            .put('/api/auth')
            .send({password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('email and password are required');
    });

    it('should return 400 if password is missing', async () => {
        const res = await request(app)
            .put('/api/auth')
            .send({ email: 'test@jwt.com' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('email and password are required');
    });
});

describe('DELETE /api/auth - Logout', () => {
    it('should logout authenticated user', async () => {
        const user = { id: 1, name: 'test user', email: 'test@jwt.com', roles: [{ role: Role.Diner }] };
        const token = jwt.sign(user, config.jwtSecret);
        DB.logoutUser.mockResolvedValue();
        DB.isLoggedIn.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/auth')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('logout successful');
    });

    it('should return 401 if no token provided', async () => {
        const res = await request(app).delete('/api/auth');

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('unauthorized');
    });
});

describe('setAuth', () => {
    it('should create and store token for user', async () => {
        const user = { id: 1, name: 'test user', roles: [{ role: Role.Diner }] };
        DB.loginUser.mockResolvedValue();

        const token = await setAuth(user);

        expect(token).toBeDefined();
        expect(DB.loginUser).toHaveBeenCalledWith(user.id, token);
    });
});

describe('setAuthUser middleware', () => {
    it('should set req.user when valid token in header', async () => {
        const user = { id: 1, name: 'test user', roles: [{ role: Role.Diner }] };
        const token = jwt.sign(user, config.jwtSecret);
        DB.isLoggedIn.mockResolvedValue(true);

        const req = {
            headers: { authorization: `Bearer ${token}` },
        };
        const res = {};
        const next = jest.fn();

        await setAuthUser(req, res, next);

        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(user.id);
        expect(typeof req.user.isRole).toBe('function');
        expect(next).toHaveBeenCalled();
    });

    it('should not set req.user when token not logged in', async () => {
        const user = { id: 1, name: 'test user', roles: [{ role: Role.Diner }] };
        const token = jwt.sign(user, config.jwtSecret);
        DB.isLoggedIn.mockResolvedValue(false);

        const req = {
            headers: { authorization: `Bearer ${token}` },
        };
        const res = {};
        const next = jest.fn();

        await setAuthUser(req, res, next);

        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalled();
    });

    it('should call next even without token', async () => {
        const req = { headers: {} };
        const res = {};
        const next = jest.fn();

        await setAuthUser(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
