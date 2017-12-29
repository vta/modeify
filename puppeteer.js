const puppeteer = require("puppeteer");
const url = process.argv[2];

function createRandomString( length )
{
    var str = "";
    for ( ; str.length < length; str += Math.random().toString( 36 ).substr( 2 ) );
    return str.substr( 0, length );
}

var img = createRandomString(16);

puppeteer.launch().then(async browser => {
    const page = await browser.newPage();
    await page.setViewport({"width":1200, "height":1000});
    await page.goto(url, {waitUntil: 'networkidle2'});
    await page.reload();
    await page.waitFor(7000);
    await page.screenshot({path: img + '.png', fullPage: true});
    await browser.close();
    console.log(img + '.png');
});