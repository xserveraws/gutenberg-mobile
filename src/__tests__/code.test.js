/**
 * External dependencies
 */
import renderer from 'react-test-renderer';
//import renderer from 'react-test-renderer/shallow';
/**
 * Internal dependencies
 */
import Code from '../../gutenberg/packages/block-library/src/code/edit.native.js';
import { TextInput } from 'react-native';

describe( 'Code', () => {
	it( 'renders without crashing', () => {
		const component = renderer.create( <Code attributes={ { content: '' } } /> );
		const rendered = component.toJSON();
		expect( rendered ).toBeTruthy();
	} );

	it( 'renders given text without crashing', () => {
		const component = renderer.create( <Code attributes={ { content: 'sample text' } } /> );
		const testInstance = component.root;
		const textInput = testInstance.findByType( TextInput );
		expect( textInput ).toBeTruthy();
		expect( textInput.props.value ).toBe( 'sample text' );
	} );
} );