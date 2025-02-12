const request = require('supertest');
const app = require('../service');
const utils = require('../testUtils')

const testUser = { name: 'Franchise OwnerToBe', email: 'TBD', password: 'a' };
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
  const adminRes = await request(app).put('/api/auth').send(adminUser);
  adminToken = adminRes.body.token;
  utils.expectValidJwt(adminToken);
});

test('getFranchises', async () => {
    const response =  await request(app)
    .get('/api/franchise')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(response.status).toBe(200);
  expect(response.body).toBeInstanceOf(Array)
  response.body.forEach(franchise => {
    expect(franchise).toEqual(expect.objectContaining({id:expect.any(Number), name:expect.any(String), stores: expect.any(Array)}))
  });
});

test('createFranchise for TestUser', async () => {
  const franchiseName = utils.randomName();
  const response = await request(app)
  .post('/api/franchise')
  .set("Authorization", `Bearer ${adminToken}`)
  .send({name:franchiseName, admins:[{email:testUser.email}]});
  console.log(response.body);
  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({id: expect.any(Number), name: franchiseName, admins:[{email:testUser.email, id: expect.any(Number), name:'Franchise OwnerToBe'}]}))
})