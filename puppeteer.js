const puppeteer = require("puppeteer");
const url = process.argv[2];
function createRandomString( length )
{
    for ( var str = ""; str.length < length; str += Math.random().toString( 36 ).substr( 2 ) );
    return str.substr( 0, length );
}
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var img = createRandomString(16);
// const path = "snapshots/" + img + '.png';
const path = "snapshots/screenshot.png";
puppeteer.launch({
    sloMo: 250,
    headless: true,
    args:   [
        '--disable-gpu',
        '--disk-cache-size=0',
        '--media-cache-size=0',
        '--v8-cache-options=off',
        '--v8-cache-strategies-for-cache-storage=off',
        '--hide-scrollbars',
        '--deterministic-fetch'
        ]
    }).then(async browser => {
    const page = await browser.newPage();
    await page.setViewport({width: 480, height: 480});
    await page.goto(url, {waitUntil: 'networkidle0'});
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('div.readyToPrint');
    await page.screenshot({path: path, fullPage: true});
    await browser.close();
    console.log(path);
});
