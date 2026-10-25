import test from 'node:test';
import assert from 'node:assert/strict';
import { toMoney, moneyString, meetsReserve } from '../src/utils/money.js';

test('money values are normalized to exactly two decimal places', () => {
  assert.equal(moneyString(toMoney(15)), '15.00');
  assert.equal(moneyString(toMoney(15.2)), '15.20');
  assert.equal(moneyString(toMoney(15.239)), '15.24');
});

test('reserve price is met only by a positive winning bid at or above reserve', () => {
  assert.equal(meetsReserve('0.00', '20.00'), false);
  assert.equal(meetsReserve('19.99', '20.00'), false);
  assert.equal(meetsReserve('20.00', '20.00'), true);
  assert.equal(meetsReserve('22.10', null), true);
});
