'use strict'

const assert = require('assert')
const cookie = require('fastify-cookie')

assert.equal(typeof cookie, 'function')
console.log('wrap succeeded')
