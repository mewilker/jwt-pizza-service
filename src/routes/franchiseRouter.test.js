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
  await successfulFranchiseCreate();
})

test('createFranchise fails when not admin', async () =>{
  const franchiseName = utils.randomName();
  const response = await request(app)
  .post('/api/franchise')
  .set("Authorization", `Bearer ${testUserAuthToken}`)
  .send({name:franchiseName, admins:[{email:testUser.email}]});
  expect(response.status).toBe(403);
})

test('createFranchise cannot use duplicate names', async() =>{
  const franchiseName = utils.randomName();
  const response = await request(app)
  .post('/api/franchise')
  .set("Authorization", `Bearer ${adminToken}`)
  .send({name:franchiseName, admins:[{email:testUser.email}]});
  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({id: expect.any(Number), name: franchiseName, admins:[{email:testUser.email, id: expect.any(Number), name:'Franchise OwnerToBe'}]}))
  const duppedResponse = await request(app)
  .post('/api/franchise')
  .set("Authorization", `Bearer ${adminToken}`)
  .send({name:franchiseName, admins:[{email:testUser.email}]});
  expect(duppedResponse.status).toBe(500);
})

test('deleteFranchise', async() =>{
  franchiseInfo = await successfulFranchiseCreate()
  const response = await request(app)
  .delete(`/api/franchise/${franchiseInfo.id}`)
  .set("Authorization", `Bearer ${adminToken}`)
  .send();
  expect(response.status).toBe(200);
  const listResponse =  await request(app)
    .get('/api/franchise')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(listResponse.status).toBe(200);
  expect(listResponse.body).toBeInstanceOf(Array)
  expect(listResponse.body).not.toContain(expect.objectContaining({id: franchiseInfo.id, name:franchiseInfo.name, stores: expect.any(Array)}))
})

test('cannot deleteFranchise as non-admin', async() =>{
  franchiseInfo = await successfulFranchiseCreate()
  const deleteResponse = await request(app)
  .delete(`/api/franchise/${franchiseInfo.id}`)
  .set("Authorization", `Bearer ${testUserAuthToken}`)
  .send();
  expect(deleteResponse.status).toBe(403);
  const listResponse =  await request(app)
    .get('/api/franchise')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(listResponse.status).toBe(200);
  expect(listResponse.body).toBeInstanceOf(Array)
  expect(listResponse.body).toContainEqual(expect.objectContaining({id: franchiseInfo.id, name:franchiseInfo.name, stores: expect.any(Array)}))
})

test('createStore', async () => {
  franchiseInfo = await successfulFranchiseCreate();
  await successfulStoreCreate(franchiseInfo);
})

async function successfulStoreCreate(franchiseInfo){
  const storeName = utils.randomName();
  const response = await request(app)
  .post(`/api/franchise/${franchiseInfo.id}/store`)
  .set("Authorization", `Bearer ${adminToken}`)
  .send({name:storeName});
  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({id: expect.any(Number), name: storeName, franchiseId:franchiseInfo.id}))
  return {id: response.body.id, name: storeName}
}

async function successfulFranchiseCreate(){
  const franchiseName = utils.randomName();
  const response = await request(app)
  .post('/api/franchise')
  .set("Authorization", `Bearer ${adminToken}`)
  .send({name:franchiseName, admins:[{email:testUser.email}]});
  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.objectContaining({id: expect.any(Number), name: franchiseName, admins:[{email:testUser.email, id: expect.any(Number), name:'Franchise OwnerToBe'}]}))
  return {id:response.body.id, name:franchiseName};
}