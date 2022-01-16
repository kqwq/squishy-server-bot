import puppeteer from 'puppeteer';
import { keywords } from './blockedList.js';

function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

async function takeScreenshot(url) {
  for (let keyword of keywords) {
    if (url.includes(keyword)) {
      return {
        success: false,
        isBlocked: true,
        url: url,
      }
    }
  }
  if (!url.startsWith('http')) {
    url = `http://${url}`;
  }
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    // wait for the page to load
    await delay(3000);
    await page.screenshot({ path: './storage/example.png' });

    await browser.close();
  } catch (error) {
    return { success: false, url, isBlocked: false } ;
  }
    return { success: true, url, isBlocked: false } ;
}

export { takeScreenshot }