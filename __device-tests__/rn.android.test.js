/** @format */

import wd from 'wd';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
const APPIUM_SERVER_ADDRESS = 'localhost';
const APPIUM_SERVER_PORT = 4723;
const config = {
	platformName: 'Android',
	deviceName: 'Android',
	app: './android/app/build/outputs/apk/app-debug.apk', // relative to root of project
};

describe( 'Device RN tests', () => {
	let driver;

	beforeEach( async () => {
		driver = wd.promiseChainRemote( APPIUM_SERVER_ADDRESS, APPIUM_SERVER_PORT );
		await driver.init( config );
		await driver.status();
		await driver.sleep( 10000 ); // wait for app to load
	} );

	afterEach( async () => {
		await driver.quit();
	} );

	it( 'should have an Aztec view', async () => {
		expect( await driver.hasElementByAccessibilityId( 'aztec-view' ) ).toBe( true );
	} );

	it( 'can switch to html view', async () => {
		expect( await driver.hasElementByAccessibilityId( 'html-switch' ) ).toBe( true );
		expect( await driver.hasElementByAccessibilityId( 'html-view' ) ).toBe( false );
		await driver.elementByAccessibilityId( 'html-switch' ).tap();
		expect( await driver.hasElementByAccessibilityId( 'html-view' ) ).toBe( true );
	} );

	it( 'can feed Aztec with html', async () => {
		expect( await driver.hasElementByAccessibilityId( 'aztec-html' ) ).toBe( true );
		const aztecHtml = await driver.elementByAccessibilityId( 'aztec-html' );
		aztecHtml.clear();

		const html = 'hello <b>bold</b>';
		aztecHtml.sendKeys( html );

		const syncToAztec = await driver.elementByAccessibilityId( 'sync-to-aztec' );
		const syncFromAztec = await driver.elementByAccessibilityId( 'sync-from-aztec' );

		await syncToAztec.tap();
		await syncFromAztec.tap();

		expect( await aztecHtml.text() ).toBe( html );
	} );
} );
