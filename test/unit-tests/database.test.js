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

describe('deleteFranchise', () => {
    it('should delete a franchise, its stores and userRole entries', async () => {
        const admin = await createTestUser(Role.Admin);
        const franchise = await DB.createFranchise({
            name: `Franchise ${Date.now()}`,
            admins: [{ email: admin.email }],
        });
        await DB.createStore(franchise.id, { name: 'Store To Delete' });

        await DB.deleteFranchise(franchise.id);

        // verify deletion
        let connection = await DB.getConnection();
        let [rows] = await connection.query(`SELECT id FROM franchise WHERE id=?`, [franchise.id]);
        expect(rows.length).toBe(0);
        [rows] = await connection.query(`SELECT id FROM store WHERE franchiseId=?`, [franchise.id]);
        expect(rows.length).toBe(0);
        [rows] = await connection.query(`SELECT id FROM userRole WHERE objectId=?`, [franchise.id]);
        expect(rows.length).toBe(0);
        connection.end();
    });
});

describe('getFranchises', () => {
    it('should return franchises with stores for non-admin', async () => {
        const admin1 = await createTestUser(Role.Admin);
        const admin2 = await createTestUser(Role.Admin);
        const f1 = await DB.createFranchise({ name: `Franchise ${Date.now()}-1`, admins: [{ email: admin1.email }] });
        const f2 = await DB.createFranchise({ name: `Franchise ${Date.now()}-2`, admins: [{ email: admin2.email }] });
        await DB.createStore(f1.id, { name: 'Store 1' });
        await DB.createStore(f2.id, { name: 'Store 2' });

        const [franchises, more] = await DB.getFranchises(undefined, 0, 10, '*');
        expect(Array.isArray(franchises)).toBe(true);
        expect(franchises.length).toBeGreaterThanOrEqual(2);
        expect(more).toBe(false);
        expect(franchises[0].stores).toBeDefined();
        expect(franchises[0].admins).toBeUndefined();
    });

    it('should return franchises with admins when authUser is admin', async () => {
        const admin = await createTestUser(Role.Admin);
        const f = await DB.createFranchise({ name: `Franchise ${Date.now()}-admin`, admins: [{ email: admin.email }] });
        await DB.createStore(f.id, { name: 'Store A' });

        const authUser = { isRole: (r) => r === Role.Admin };
        const [franchises] = await DB.getFranchises(authUser, 0, 10, '*');
        expect(franchises.some((fr) => fr.id === f.id)).toBe(true);
        const found = franchises.find((fr) => fr.id === f.id);
        expect(found.admins).toBeDefined();
        expect(found.stores).toBeDefined();
    });
});

describe('getUserFranchises', () => {
    it('should return franchises for a franchisee user', async () => {
        const user = await createTestUser(Role.Franchisee);
        const franchises = await DB.getUserFranchises(user.id);
        expect(Array.isArray(franchises)).toBe(true);
        expect(franchises.length).toBeGreaterThanOrEqual(1);
        expect(franchises[0].id).toBeDefined();
    });

    it('should return empty array for user with no franchisee role', async () => {
        const user = await createTestUser(Role.Diner);
        const franchises = await DB.getUserFranchises(user.id);
        expect(Array.isArray(franchises)).toBe(true);
        expect(franchises.length).toBe(0);
    });
});

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