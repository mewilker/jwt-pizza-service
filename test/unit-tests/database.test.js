const { DB, Role } = require('../../src/database/database.js');

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const config = require('../../src/config.js');

beforeAll(async () => {
    let connection = await DB._getConnection(false);
    await connection.query('DROP DATABASE IF EXISTS ?', [config.db.connection.database]);
});

describe('Database Initialization', () => {
    it('should initialize the database connection', async () => {
        let connection = await DB.getConnection();
        expect(connection).toBeDefined();
        it.each([])('should have the %s table', async (tableName) => {
            
        });
        //check that all tables are there
        //check that there is an admin
        await connection.end();
    });
});

describe('getMenu', () => {
    it('should return menu items', async () => {
        const menu = await DB.getMenu();
        expect(Array.isArray(menu)).toBe(true);
    });
    //TODO: add a meatier test
});

describe('addMenuItem', () => {
    it('should add a menu item and return it with an id', async () => {
        const item = {
            title: 'Test Pizza',
            description: 'A test pizza',
            image: 'test.jpg',
            price: 12.99,
        };
        const result = await DB.addMenuItem(item);
        expect(result.id).toBeDefined();
        expect(result.title).toBe(item.title);
        expect(result.price).toBe(item.price);
    });
});

describe('addUser', () => {
    it('should add a user with admin role', async () => {
        const user = {
            name: 'Test Admin',
            email: `admin-${Date.now()}@test.com`,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        };
        const result = await DB.addUser(user);
        expect(result.id).toBeDefined();
        expect(result.name).toBe(user.name);
        expect(result.email).toBe(user.email);
        expect(result.password).toBeUndefined();
    });

    it('should add a user with franchisee role', async () => {
        const franchise = await DB.createFranchise({ name: `Test Franchise ${Date.now()}`, admins: [] });
        const user = {
            name: 'Test Franchisee',
            email: `franchisee-${Date.now()}@test.com`,
            password: 'password123',
            roles: [{ role: Role.Franchisee, object: franchise.name }],
        };
        const result = await DB.addUser(user);
        expect(result.id).toBeDefined();
        expect(result.roles).toHaveLength(1);
        expect(result.roles[0].role).toBe(Role.Franchisee);
    });

    //TODO DINER role test
});

describe('getUser', () => {
    it('should retrieve a user by email and password', async () => {
        const email = `user-${Date.now()}@test.com`;
        const password = 'testpass123';
        await DB.addUser({
            name: 'Test User',
            email,
            password,
            roles: [{ role: Role.Admin }],
        });
        const user = await DB.getUser(email, password);
        expect(user.email).toBe(email);
        expect(user.password).toBeUndefined();
    });

    it('should throw error for unknown user', async () => {
        await expect(DB.getUser('nonexistent@test.com', 'password')).rejects.toThrow();
    });

    it('should throw error for incorrect password', async () => {
        const email = `user-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Test User',
            email,
            password: 'correctpassword',
            roles: [{ role: Role.Admin }],
        });
        await expect(DB.getUser(email, 'wrongpassword')).rejects.toThrow();
    });

    it('should retrieve user without password check', async () => {
        const email = `user-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Test User',
            email,
            password: 'testpass',
            roles: [{ role: Role.Admin }],
        });
        const user = await DB.getUser(email);
        expect(user.email).toBe(email);
    });
});

describe('updateUser', () => {
    it('should update user name and email', async () => {
        const email = `original-${Date.now()}@test.com`;
        const newEmail = `updated-${Date.now()}@test.com`;
        const user = await DB.addUser({
            name: 'Original Name',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const updated = await DB.updateUser(user.id, 'Updated Name', newEmail, null);
        expect(updated.name).toBe('Updated Name');
        expect(updated.email).toBe(newEmail);
    });

    it('should update user password', async () => {
        const email = `user-${Date.now()}@test.com`;
        const oldPassword = 'oldpassword';
        const newPassword = 'newpassword';
        const user = await DB.addUser({
            name: 'Test User',
            email,
            password: oldPassword,
            roles: [{ role: Role.Admin }],
        });
        await DB.updateUser(user.id, null, null, newPassword);
        const retrievedUser = await DB.getUser(email, newPassword);
        expect(retrievedUser.email).toBe(email);
    });
});

describe('loginUser and isLoggedIn', () => {
    it('should login user and verify login status', async () => {
        const token = 'header.payload.signature';
        const email = `user-${Date.now()}@test.com`;
        const user = await DB.addUser({
            name: 'Test User',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        await DB.loginUser(user.id, token);
        const isLoggedIn = await DB.isLoggedIn(token);
        expect(isLoggedIn).toBe(true);
    });
});

describe('logoutUser', () => {
    it('should logout user', async () => {
        const token = 'header.payload.signature2';
        const email = `user-${Date.now()}@test.com`;
        const user = await DB.addUser({
            name: 'Test User',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        await DB.loginUser(user.id, token);
        await DB.logoutUser(token);
        const isLoggedIn = await DB.isLoggedIn(token);
        expect(isLoggedIn).toBe(false);
    });
});

describe('createFranchise', () => {
    it('should create a franchise with admins', async () => {
        const email = `admin-${Date.now()}@test.com`;
        const admin = await DB.addUser({
            name: 'Franchise Admin',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email }],
        });
        expect(franchise.id).toBeDefined();
        expect(franchise.admins).toHaveLength(1);
        expect(franchise.admins[0].email).toBe(email);
    });

    it('should throw error for unknown admin email', async () => {
        await expect(
            DB.createFranchise({
                name: `Franchise ${Date.now()}`,
                admins: [{ email: 'nonexistent@test.com' }],
            })
        ).rejects.toThrow();
    });
});

describe('getFranchise', () => {
    it('should retrieve franchise with admins and stores', async () => {
        const email = `admin-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Franchise Admin',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email }],
        });
        const retrieved = await DB.getFranchise(franchise);
        expect(retrieved.admins).toBeDefined();
        expect(retrieved.stores).toBeDefined();
    });
});

describe('createStore and deleteStore', () => {
    it('should create a store', async () => {
        const email = `admin-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Franchise Admin',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email }],
        });
        const store = await DB.createStore(franchise.id, { name: 'Test Store' });
        expect(store.id).toBeDefined();
        expect(store.name).toBe('Test Store');
        expect(store.franchiseId).toBe(franchise.id);
    });

    it('should delete a store', async () => {
        const email = `admin-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Franchise Admin',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email }],
        });
        const store = await DB.createStore(franchise.id, { name: 'Test Store' });
        await DB.deleteStore(franchise.id, store.id);
        // Verify deletion by checking that the store query returns empty
        const franchiseData = await DB.getFranchise(franchise);
        expect(franchiseData.stores.some((s) => s.id === store.id)).toBe(false);
    });
});

describe('addDinerOrder and getOrders', () => {
    it('should add a diner order and retrieve it', async () => {
        const email = `user-${Date.now()}@test.com`;
        const user = await DB.addUser({
            name: 'Test Diner',
            email,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchiseEmail = `admin-${Date.now()}@test.com`;
        await DB.addUser({
            name: 'Franchise Admin',
            email: franchiseEmail,
            password: 'password123',
            roles: [{ role: Role.Admin }],
        });
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: franchiseEmail }],
        });
        const store = await DB.createStore(franchise.id, { name: 'Test Store' });
        const item = await DB.addMenuItem({
            title: 'Test Item',
            description: 'Test',
            image: 'test.jpg',
            price: 10.0,
        });
        const order = await DB.addDinerOrder(user, {
            franchiseId: franchise.id,
            storeId: store.id,
            items: [{ menuId: item.id, description: item.title, price: item.price }],
        });
        expect(order.id).toBeDefined();
        const orders = await DB.getOrders(user);
        expect(orders.orders).toHaveLength(1);
    });
});

describe('getTokenSignature', () => {
    it('should extract token signature', () => {
        const token = 'header.payload.signature';
        const signature = DB.getTokenSignature(token);
        expect(signature).toBe('signature');
    });

    it('should return empty string for invalid token', () => {
        const token = 'invalid';
        const signature = DB.getTokenSignature(token);
        expect(signature).toBe('');
    });
});

describe('getOffset', () => {
    it('should calculate correct offset', () => {
        const offset = DB.getOffset(1, 10);
        expect(offset).toBe(0);
    });

    it('should calculate offset for page 2', () => {
        const offset = DB.getOffset(2, 10);
        expect(offset).toBe(10);
    });
});