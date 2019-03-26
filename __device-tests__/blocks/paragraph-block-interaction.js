/** @flow
 * @format */

/**
 * Internal dependencies
 */
import BlockInteraction from './block-interaction';
/**
 * External dependencies
 */
import wd from 'wd';
import { isAndroid } from '../helpers/utils';

export default class ParagraphBlockInteraction extends BlockInteraction {
	// FLow complaining about type annotation on Set class here but Set<string>(); doesn't resolve
	// $FlowFixMe
	static blocks = new Set();
	textViewElement: wd.PromiseChainWebdriver.Element;

	constructor( driver: wd.PromiseChainWebdriver, name: string = 'Unsupported Block' ) {
		super( driver );
		this.driver = driver;
		this.name = name; // name in block picker list
		this.blockName = 'core/paragraph';
	}

	// gets the TextView wd element for this paragraph block and sets it to
	// the textViewElement attribute for this object
	async setupTextView() {
		await this.driver.sleep( 2000 );
		let textViewElement = 'XCUIElementTypeTextView';
		if ( isAndroid() ) {
			textViewElement = 'android.widget.EditText';
		}
		const blockLocator = `//*[@${ this.accessibilityIdXPathAttrib }="${ this.accessibilityId }"]//${ textViewElement }`;
		this.textViewElement = await this.driver.elementByXPath( blockLocator );
	}

	async setup() {
		await this.setupElement( this.blockName, ParagraphBlockInteraction.blocks );
		await this.setupTextView();
	}

	async sendText( str: string ) {
		return await this.typeString( this.textViewElement, str );
	}

	async getText() {
		const text = await this.textViewElement.text();
		return text.toString().trim();
	}
}