const request = require('supertest');
const app = require('../service');
const utils = require('../testUtils')

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let adminUser;
let adminToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = utils.randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  utils.expectValidJwt(testUserAuthToken);
  adminUser = await utils.createAdminUser();
  const adminRes = await request(app).post('/api/auth').send(adminUser);
  adminToken = adminRes.body.token;
  utils.expectValidJwt(adminToken);
});

test('getFranchises', async () => {
    const response =  await request(app)
    .get('/api/franchise')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(response.status).toBe(200);
  console.log(response.body)
  expect(response.body).toBeInstanceOf(Array)
  response.body.forEach(franchise => {
    expect(franchise).toEqual(expect.objectContaining({id:expect.any(Number), name:expect.any(String), stores: expect.any(Array)}))
  });
});