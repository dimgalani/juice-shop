/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import { expect } from '@jest/globals'
import config from 'config'

const API_URL = 'http://localhost:3000/api'
const REST_URL = 'http://localhost:3000/rest'

const jsonHeader = { 'content-type': 'application/json' }
let authHeader: { Authorization: string, 'content-type': string }

// Default global setup for frisby headers
frisby.globalSetup({
  request: {
    headers: jsonHeader
  }
})

// Helper Functions
const loginUser = () => {
  return frisby.post(REST_URL + '/user/login', {
    body: {
      email: 'jim@' + config.get<string>('application.domain'),
      password: 'ncc-1701'
    }
  })
    .expect('status', 200)
    .then(({ json }) => {
      authHeader = {
        Authorization: 'Bearer ' + json.authentication.token,
        'content-type': 'application/json'
      }
    })
}

const postBasketItem = (basketId: number, productId: number, quantity: number) => {
  return frisby.post(API_URL + '/BasketItems', {
    headers: authHeader,
    body: { BasketId: basketId, ProductId: productId, quantity: quantity }
  })
}

const putBasketItem = (itemId: number, body: object) => {
  return frisby.put(API_URL + '/BasketItems/' + itemId, {
    headers: authHeader,
    body
  })
}

const getBasketItem = (itemId: number) => {
  return frisby.get(API_URL + '/BasketItems/' + itemId, { headers: authHeader })
}

const deleteBasketItem = (itemId: number) => {
  return frisby.del(API_URL + '/BasketItems/' + itemId, { headers: authHeader })
}

// Test Suite
beforeAll(() => {
  return loginUser()
})

describe('/api/BasketItems', () => {
  it('GET all basket items is forbidden via public API', () => {
    return frisby.get(API_URL + '/BasketItems').expect('status', 401)
  })

  it('POST new basket item is forbidden via public API', () => {
    return frisby.post(API_URL + '/BasketItems', {
      body: { BasketId: 2, ProductId: 1, quantity: 1 }
    }).expect('status', 401)
  })

  it('GET all basket items', () => {
    return frisby.get(API_URL + '/BasketItems', { headers: authHeader })
      .expect('status', 200)
  })

  // Parameterized Tests for POST basket items
  const postTestCases = [
    { basketId: 2, productId: 2, quantity: 1, expectedStatus: 200 },
    { basketId: 2, productId: 2, quantity: 101, expectedStatus: 400 },
    { basketId: 2, productId: 1, quantity: 6, expectedStatus: 400 }
  ]

  postTestCases.forEach(test => {
    it(`POST basket item with quantity ${test.quantity} should return status ${test.expectedStatus}`, () => {
      return postBasketItem(test.basketId, test.productId, test.quantity)
        .expect('status', test.expectedStatus)
    })
  })
})

describe('/api/BasketItems/:id', () => {
  it('GET basket item by id is forbidden via public API', () => {
    return frisby.get(API_URL + '/BasketItems/1').expect('status', 401)
  })

  it('PUT update basket item is forbidden via public API', () => {
    return frisby.put(API_URL + '/BasketItems/1', { quantity: 2 }, { json: true })
      .expect('status', 401)
  })

  it('DELETE basket item is forbidden via public API', () => {
    return frisby.del(API_URL + '/BasketItems/1').expect('status', 401)
  })

  it('POST, GET and DELETE newly created basket item', () => {
    return postBasketItem(2, 6, 3)
      .expect('status', 200)
      .then(({ json }) => {
        const itemId = json.data.id

        return getBasketItem(itemId)
          .expect('status', 200)
          .then(() => deleteBasketItem(itemId).expect('status', 200))
      })
  })

  it('PUT update newly created basket item', () => {
    return postBasketItem(2, 3, 3)
      .expect('status', 200)
      .then(({ json }) => {
        const itemId = json.data.id
        return putBasketItem(itemId, { quantity: 20 })
          .expect('status', 200)
          .expect('json', 'data', { quantity: 20 })
      })
  })

  it('PUT update basket item with invalid updates is forbidden', () => {
    return postBasketItem(2, 8, 8)
      .expect('status', 200)
      .then(({ json }) => {
        const itemId = json.data.id
        return putBasketItem(itemId, { BasketId: 42 })
          .expect('status', 400)
          .expect('json', { message: 'null: `BasketId` cannot be updated due `noUpdate` constraint' })
      })
  })

  it('PUT update basket item with more than allowed quantity is forbidden', () => {
    return postBasketItem(2, 1, 1)
      .expect('status', 200)
      .then(({ json }) => {
        const itemId = json.data.id
        return putBasketItem(itemId, { quantity: 6 })
          .expect('status', 400)
          .expect('json', 'error', 'You can order only up to 5 items of this product.')
      })
  })
})
