const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(registerRes.body.token);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
});

test('register', async () =>{
  const newUser = { name: "rookie", email: "tbd", password: "rookie"}
  newUser.email = Math.random().toString(36).substring(2,12);
  const response = await request(app).post('/api/auth').send(newUser);
  expect(response.status).toBe(200);
  expectValidJwt(response.body.token);

  const { password, ...user } = { ...newUser, roles: [{ role: 'diner' }] };
  expect(response.body.user).toMatchObject(user);
});

test('logout', async () => {
  const response =  await request(app)
    .delete('/api/auth')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(response.status).toBe(200);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}
