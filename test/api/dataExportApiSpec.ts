import frisby = require('frisby');
import { expect } from '@jest/globals';
import config from 'config';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

const jsonHeader = { 'content-type': 'application/json' };
const REST_URL = 'http://localhost:3000/rest';

// Helper function to login and get the auth token
const login = (email: string, password: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    frisby.post(REST_URL + '/user/login', {
      headers: jsonHeader,
      body: { email, password }
    }).expect('status', 200)
      .then(response => response.json())
      .then(json => {
        const data = json as { authentication: { token: string } };
        resolve(data.authentication.token);
      })
      .catch(err => reject(err));
  });
};

const exportData = (token: string, body: object): Promise<frisby.FrisbyResponse> => {
  return frisby.post(REST_URL + '/user/data-export', {
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body
  }).promise();
};

describe('/rest/user/data-export', () => {
  it('Export data without use of CAPTCHA', async () => {
    const token = await login('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=');
    const response = await exportData(token, { format: 1 });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.json.confirmation).toBe('Your data export will open in a new Browser window.');

    const parsedData = JSON.parse(response.json.userData);
    expect(parsedData.username).toBe('bkimminich');
    expect(parsedData.email).toBe('bjoern.kimminich@gmail.com');
  });


  it('Export data when CAPTCHA requested need right answer', async () => {
    const token = await login('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=');
    const captchaResponse = await frisby.get(REST_URL + '/image-captcha', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    }).expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .promise();


   const response = await exportData(token, {
      answer: 'AAAAAA',
      format: 1
    });
    expect(response.status).toBe(401);
    expect(response.body).toContain('Wrong answer to CAPTCHA. Please try again.');
  });

  it('Export data using right answer to CAPTCHA', async () => {
    const token = await login('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=');
    const captchaResponse = await frisby.get(REST_URL + '/image-captcha', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    }).expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .promise();
        const response = await exportData(token, {
      answer: captchaResponse.json.answer,
      format: 1
    });
     expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.json.confirmation).toBe('Your data export will open in a new Browser window.');

    const parsedData = JSON.parse(response.json.userData);
    expect(parsedData.username).toBe('bkimminich');
    expect(parsedData.email).toBe('bjoern.kimminich@gmail.com');
  });

  it('Export data including orders without use of CAPTCHA', async () => {
    const token = await login('amy@' + config.get<string>('application.domain'), 'K1f.....................');
    await frisby.post(REST_URL + '/basket/4/checkout', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    }).expect('status', 200).promise();

    const response = await exportData(token, { format: '1' });
    expect(response.status).toBe(200);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.json.confirmation).toBe('Your data export will open in a new Browser window.');
    const parsedData = JSON.parse(response.json.userData);
    expect(parsedData.username).toBe('');
    expect(parsedData.email).toBe('amy@' + config.get<string>('application.domain'));
    expect(parsedData.orders[0].totalPrice).toBe(9.98);
    expect(parsedData.orders[0].bonus).toBe(0);
    expect(parsedData.orders[0].products[0].quantity).toBe(2);
    expect(parsedData.orders[0].products[0].name).toBe('Raspberry Juice (1000ml)');
    expect(parsedData.orders[0].products[0].price).toBe(4.99);
    expect(parsedData.orders[0].products[0].total).toBe(9.98);
    expect(parsedData.orders[0].products[0].bonus).toBe(0);
  });

  it('Export data including reviews without use of CAPTCHA', async () => {
    const token = await login('jim@' + config.get<string>('application.domain'), 'ncc-1701');
    const response = await exportData(token, { format: '1' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.json.confirmation).toBe('Your data export will open in a new Browser window.');

    const parsedData = JSON.parse(response.json.userData);
    expect(parsedData.username).toBe('');
    expect(parsedData.email).toBe('jim@' + config.get<string>('application.domain'));
    expect(parsedData.reviews[0].message).toBe('Looks so much better on my uniform than the boring Starfleet symbol.');
    expect(parsedData.reviews[0].author).toBe('jim@' + config.get<string>('application.domain'));
    expect(parsedData.reviews[0].productId).toBe(20);
    expect(parsedData.reviews[0].likesCount).toBe(0);
    expect(parsedData.reviews[0].likedBy[0]).toBe(undefined);
    expect(parsedData.reviews[1].message).toBe('Fresh out of a replicator.');
    expect(parsedData.reviews[1].author).toBe('jim@' + config.get<string>('application.domain'));
    expect(parsedData.reviews[1].productId).toBe(22);
    expect(parsedData.reviews[1].likesCount).toBe(0);
    expect(parsedData.reviews[1].likedBy[0]).toBe(undefined);
  });

  it('Export data including memories without use of CAPTCHA', async () => {
    const file = path.resolve(__dirname, 'path/to/your/image.jpg'); // Define the file path
    const form = new FormData();
    form.append('image', fs.createReadStream(file), 'Valid Image');
    form.append('caption', 'Valid Image');

    const token = await login('jim@' + config.get<string>('application.domain'), 'ncc-1701');
    await frisby.post(REST_URL + '/memories', {
      headers: {
        ...form.getHeaders(),
        'Content-Type': form.getHeaders()['content-type']
      },
      body: form
    }).expect('status', 200).promise();

    const response = await exportData(token, { format: '1' });
    expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/application\/json/);
      expect(response.json.confirmation).toBe('Your data export will open in a new Browser window.');

    const parsedData = JSON.parse(response.json.userData);
    expect(parsedData.username).toBe('');
    expect(parsedData.email).toBe('jim@' + config.get<string>('application.domain'));
    expect(parsedData.memories[0].caption).toBe('Valid Image');
    expect(parsedData.memories[0].imageUrl).toContain('assets/public/images/uploads/valid-image');
  });

  it('Export data including orders with use of CAPTCHA', async () => {
    const token = await login('amy@' + config.get<string>('application.domain'), 'K1f.....................');
    await frisby.post(REST_URL + '/basket/4/checkout', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    }).expect('status', 200).promise();

    const response = await frisby.get(REST_URL + '/image-captcha', {
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    }).expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .promise();

    const exportResponse = await exportData(token, {
      answer: 'wrongAnswer', // Incorrect CAPTCHA answer
      format: 1
    });

    expect(exportResponse.status).toBe(401);
    expect(exportResponse.body).toContain('Wrong answer to CAPTCHA. Please try again.');
  });
});









