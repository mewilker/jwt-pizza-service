const request = require('supertest');
const app = require('../service');
const utils = require('../testUtils');

const plebUser = { name: 'sneaky dinner', email: 'TBD', password: 'a'}
let plebToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
}
  
beforeAll(async () => {
    plebUser.email = utils.randomName() + '@test.com';
    const response = await request(app).post('/api/auth').send(plebUser);
    plebToken = response.body.token;
    utils.expectValidJwt(response.body.token);
});

test('getMenu', async () =>{
    const response = await request(app).get('/api/order/menu').send();
    expect(response.status).toBe(200)
    expect(response.body).toBeInstanceOf(Array)
    response.body.forEach(item => {
        expect(item).toEqual(expect.objectContaining({
            id:expect.any(Number), 
            title:expect.any(String), 
            price:expect.any(Number), 
            description:expect.any(String), 
            image:expect.any(String)}))
    });
})

test('make Order unauthenticated', async () =>{
    const response = await request(app).post('/api/order').send();
    expect(response.status).toBe(401);
})

test('makeOrder', async () =>{
    const response = await request(app)
    .post('/api/order')
    .set("Authorization", `Bearer: ${plebToken}`)
    .send({franchiseId: 1, storeId:1, items:[{ menuId: 1, description: "Veggie", price: 0.05 }]});
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({order:{franchiseId:1, storeId:1, items: [{menuId:1, description:'Veggie', price: 0.05}], id:expect.any(Number)}}));
})

test('getOrders', async () =>{
    const response = await request(app)
    .get('/api/order')
    .set("Authorization", `Bearer: ${plebToken}`)
    .send();
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({dinerId:expect.any(Number), orders: expect.any(Array), page:expect.any(Number)}))
})

test('cant add MenuItem as non-admin', async () =>{
    const response = await request(app)
    .put('/api/order/menu')
    .set("Authorization", `Bearer: ${plebToken}`)
    .send();
    expect(response.status).toBe(403);
})