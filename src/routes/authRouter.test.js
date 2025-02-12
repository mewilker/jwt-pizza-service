const request = require('supertest');
const app = require('../service');
const utils = require('../testUtils')

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  utils.expectValidJwt(registerRes.body.token);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  utils.expectValidJwt(loginRes.body.token);

  const user = { ...testUser, roles: [{ role: 'diner' }] };
  delete user.password;
  expect(loginRes.body.user).toMatchObject(user);
});

test('login bad password', async () =>{
  const response = await request(app).put('/api/auth').send({ name: 'pizza diner',email: 'reg@test.com', password: 'bad'});
  expect(response.status).toBe(404);
});

test('register', async () =>{
  const newUser = { name: "rookie", email: "tbd", password: "rookie"}
  newUser.email = Math.random().toString(36).substring(2,12);
  const response = await request(app).post('/api/auth').send(newUser);
  expect(response.status).toBe(200);
  utils.expectValidJwt(response.body.token);
  
  const user = { ...newUser, roles: [{ role: 'diner' }] };
  delete user.password
  expect(response.body.user).toMatchObject(user);
});

test('register bad request', async () =>{
  const response = await request(app).post('/api/auth').send({name: 'reg@test.com'});
  expect(response.status).toBe(400)
})

test('logout', async () => {
  const response =  await request(app)
    .delete('/api/auth')
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(response.status).toBe(200);
});

test('logout bad auth', async () =>{
  const response = await request(app).delete('/api/auth').set("Authorization", `Bearer badboy`).send();
  expect(response.status).toBe(401);
})
