import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'*.spec.mjs',fullyParallel:false,workers:1,retries:0,
 forbidOnly:true,maxFailures:3,timeout:30000,expect:{timeout:8000},
 reporter:[['list'],['json',{outputFile:'results.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',locale:'en-GB',timezoneId:'Europe/London',trace:'off',screenshot:'off',video:'off'},
 projects:[
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
  {name:'firefox-desktop',use:{browserName:'firefox',viewport:{width:1440,height:900}}},
  {name:'webkit-desktop',use:{browserName:'webkit',viewport:{width:1440,height:900}}},
  {name:'chromium-mobile',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'chromium-tablet',use:{browserName:'chromium',viewport:{width:768,height:1024},hasTouch:true}}
 ],
 webServer:{command:'node serve.mjs',url:'http://127.0.0.1:4173/__test/health',reuseExistingServer:false,timeout:15000}
});
