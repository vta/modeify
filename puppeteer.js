const puppeteer = require("puppeteer");
const url = process.argv[2];
function createRandomString( length )
{
    for ( var str = ""; str.length < length; str += Math.random().toString( 36 ).substr( 2 ) );
    return str.substr( 0, length );
}

var img = createRandomString(16);
const path = "snapshots/" + img + '.png'
puppeteer.launch().then(async browser => {
    const page = await browser.newPage();
    await page.setViewport({"width":await page.evaluate(() => document.body.clientWidth), "height":await page.evaluate(() => document.body.clientHeight)});
    //await page.setViewport({"width":1200, "height":1200});
    await page.goto(url, {waitUntil: 'networkidle2'});
    await page.reload();
    await page.waitFor(7500);
    await page.screenshot({path: path, fullPage: true});
    await browser.close();
    console.log(path);
});

