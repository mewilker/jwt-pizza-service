const { DB, Role } = require('../../src/database/database.js');
const mysql = require('mysql2/promise');
const config = require('../../src/config.js');

//vscode debugger timeout
if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
    await DB.initialized;
    const connection = await mysql.createConnection({
        host: config.db.connection.host,
        user: config.db.connection.user,
        password: config.db.connection.password,
        connectTimeout: config.db.connection.connectTimeout,
        decimalNumbers: true,
    });
    await connection.execute(`DROP DATABASE IF EXISTS ${config.db.connection.database}`);
    connection.end();
    await DB.initializeDatabase();
});

describe('Database Initialization', () => {
    it('should initialize the database connection', async () => {
        let connection = await DB.getConnection();
        expect(connection).toBeDefined();
        connection.end();
    });
    //if the database is actually case-insensitive these will most likely be converted to lowercase
    it.each([
        "auth", 
        "user",
        "menu",
        "franchise",
        "store",
        "userRole",
        "dinerOrder",
        "orderItem"
    ])('should have the %s table', async (tableName) => {
        let connection = await DB.getConnection();
        const query = `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'pizza' AND TABLE_NAME = ?
        `;
        const [rows] = await connection.query(query, [tableName]);
        expect(rows.length).toBe(1);
        expect(rows[0].TABLE_NAME).toBe(tableName);
        connection.end();
    });
    it('should have an admin user', async () => {
        const admin = await DB.getUser(config.admin.email, config.admin.password);
        expect(admin).toBeDefined();
        expect(admin.email).toBe(config.admin.email);
    });
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
        expect(result.description).toBe(item.description);
        expect(result.image).toBe(item.image);
    });
});

describe('getMenu',  () => {
    it.each([0,1,2,3])('should return %i menu items', async (count) => {
        let connection = await DB.getConnection();
        await connection.query('TRUNCATE TABLE menu');
        await connection.end();
        for (let i = 0; i < count; i++) {
            await DB.addMenuItem({
                title: `Pizza ${i}`,
                description: `A pizza ${i}`,
                image: `pizza-${i}.jpg`,
                price: 10.99 + i,
            });
        }
        const menu = await DB.getMenu();
        expect(Array.isArray(menu)).toBe(true);
        expect(menu.length).toBe(count);
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
        const result = await createTestUser(Role.Franchisee);
        expect(result.id).toBeDefined();
        expect(result.roles).toHaveLength(1);
        expect(result.roles[0].role).toBe(Role.Franchisee);
    });

    it ('should add a diner user', async () => {
        const result = await createTestUser(Role.Diner);
        expect(result.id).toBeDefined();
        expect(result.roles).toHaveLength(1);
        expect(result.roles[0].role).toBe(Role.Diner);
    });
});

describe('getUser', () => {
    it('should retrieve a user by email and password', async () => {
        const result = await createTestUser(Role.Diner);
        const user = await DB.getUser(result.email, 'password123');
        expect(user.email).toBe(result.email);
        expect(user.password).toBeUndefined();
    });

    it('should throw error for unknown user', async () => {
        await expect(DB.getUser('nonexistent@test.com', 'password')).rejects.toThrow();
    });

    it('should throw error for incorrect password', async () => {
        const result = await createTestUser(Role.Diner);
        await expect(DB.getUser(result.email, 'wrongpassword')).rejects.toThrow();
    });

    it('should retrieve user without password check', async () => {
        const result = await createTestUser(Role.Diner);
        const user = await DB.getUser(result.email);
        expect(user.email).toBe(result.email);
    });
});

describe('loginUser and isLoggedIn', () => {
    it('should login user and verify login status', async () => {
        const token = 'header.payload.signature';
        const user = await createTestUser(Role.Diner);
        await DB.loginUser(user.id, token);
        const isLoggedIn = await DB.isLoggedIn(token);
        expect(isLoggedIn).toBe(true);
    });
});

describe('logoutUser', () => {
    it('should logout user', async () => {
        const token = 'header.payload.signature2';
        const user = await createTestUser(Role.Diner);
        await DB.loginUser(user.id, token);
        await DB.logoutUser(token);
        const isLoggedIn = await DB.isLoggedIn(token);
        expect(isLoggedIn).toBe(false);
    });
});

describe('createFranchise', () => {
    it('should create a franchise with admins', async () => {
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

//deleteFranchise is not implemented

//getFranchises is not implemented
//getUserfranchises is not implemented

describe('getFranchise', () => {
    it('should retrieve franchise with admins and stores', async () => {
        const result = await createTestUser(Role.Admin);
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: result.email }],
        });
        const retrieved = await DB.getFranchise(franchise);
        expect(retrieved.admins).toBeDefined();
        expect(retrieved.stores).toBeDefined();
    });
});

describe('createStore and deleteStore', () => {
    it('should create a store', async () => {
        const result = await createTestUser(Role.Admin);
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: result.email }],
        });
        const store = await DB.createStore(franchise.id, { name: 'Test Store' });
        expect(store.id).toBeDefined();
        expect(store.name).toBe('Test Store');
        expect(store.franchiseId).toBe(franchise.id);
    });

    it('should delete a store', async () => {
        const result = await createTestUser(Role.Admin);
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: result.email }],
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
        const user = await createTestUser(Role.Diner);
        const admin = await createTestUser(Role.Admin);
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: admin.email }],
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

async function createTestUser(role) {
    const email = `user-${role}-${Date.now()}@test.com`;
    const name = `Test User - ${Date.now()} ${role}`;
    const password = 'password123';
    if (role === Role.Franchisee){
        const franchise = await DB.createFranchise({ name: `Test Franchise ${Date.now()}`, admins: [] });
        return await DB.addUser({
            name,
            email,
            password,
            roles: [{ role, object: franchise.name }],
        });
    }
    return await DB.addUser({
        name,
        email,
        password,
        roles: [{ role }],
    });
};