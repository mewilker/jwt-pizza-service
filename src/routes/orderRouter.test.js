const request = require('supertest');
const app = require('../service');
const utils = require('../testUtils');

const plebUser = { name: 'hungry dinner', email: 'TBD', password: 'a'}
let plebToken;
let adminUser;
let adminToken;
const franchisee = {name: "im sodone", email:'TBD', password: 'a'}
let franchiseeToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
}
  
beforeAll(async () => {
    plebUser.email = utils.randomName() + '@test.com';
    const response = await request(app).post('/api/auth').send(plebUser);
    plebToken = response.body.token;
    utils.expectValidJwt(response.body.token);
    franchisee.email = utils.randomName() + '@test.com';
    const franchiseeRes = await request(app).post('/api/auth').send(franchisee);
    franchiseeToken = franchiseeRes.body.token;
    utils.expectValidJwt(franchiseeRes.body.token);
    adminUser = await utils.createAdminUser();
    const adminRes = await request(app).put('/api/auth').send(adminUser);
    adminToken = adminRes.body.token;
    utils.expectValidJwt(adminRes.body.token);
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
    const menuItem = await createMenuItem();
    const franchiseInfo = await successfulFranchiseCreate();
    const storeInfo = await successfulStoreCreate(franchiseInfo, adminToken)
    const response = await request(app)
    .post('/api/order')
    .set("Authorization", `Bearer: ${plebToken}`)
    .send({franchiseId: franchiseInfo.id, storeId:storeInfo.id, items:[{ menuId: menuItem.id, description: menuItem.description, price: menuItem.price }]});
    console.log(response.body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({order:{franchiseId:franchiseInfo.id, storeId:storeInfo.id, items: expect.any(Array), id:expect.any(Number)}}));
    expect(response.body.order.items).toContainEqual(expect.objectContaining({menuId:menuItem.id, description:menuItem.description, price: menuItem.price}));
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

test('add MenuItem', async() =>{
    await createMenuItem();
});

async function createMenuItem () {
    const itemName = utils.randomName();
    const itemDescription = utils.randomName();
    const itemImage = utils.randomName() + ".png";
    const itemPrice = 0.0001;
    let itemID;
    const response = await request(app)
    .put('/api/order/menu')
    .set("Authorization", `Bearer: ${adminToken}`)
    .send({title:itemName, 
        description: itemDescription, 
        image:itemImage,
        price: itemPrice });
    console.log(response.body);
    expect(response.status).toBe(200);
    expect(response.body).toContainEqual(expect.objectContaining({
        id:expect.any(Number),
        title:itemName,
        description:itemDescription,
        image: itemImage,
        price: itemPrice
    }));
     for (let i=response.body.length-1; i>-1; i--){
        const menu = response.body[i];
        if (menu.title === itemName && menu.description === itemDescription){
            itemID = menu.id;
            break;
        }
    }
    return {
        id: itemID,
        title: itemName,
        description: itemDescription,
        image: itemImage,
        price: itemPrice,
    }
}

async function successfulStoreCreate(franchiseInfo, token){
    const storeName = utils.randomName();
    const response = await request(app)
    .post(`/api/franchise/${franchiseInfo.id}/store`)
    .set("Authorization", `Bearer ${token}`)
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
    .send({name:franchiseName, admins:[{email:franchisee.email}]});
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({id: expect.any(Number), name: franchiseName, admins:[{email:franchisee.email, id: expect.any(Number), name:franchisee.name}]}))
    return {id:response.body.id, name:franchiseName};
  }