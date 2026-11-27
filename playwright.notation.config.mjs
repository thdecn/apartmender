import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',workers:1,
  testMatch:['catalog','notation-descriptor','public-practice','public-score','fingerings','student-fingerings',
    'teacher-fingerings','score-pages','notation-pilot'].map(name=>`**/${name}.spec.js`),
  use:{trace:'retain-on-failure',screenshot:'only-on-failure'},
});
