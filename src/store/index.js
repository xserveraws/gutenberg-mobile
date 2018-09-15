/**
 * @format
 * @flow
 */

// Gutenberg imports
import { registerCoreBlocks } from '@wordpress/block-library';
import { parse, registerBlockType, setUnknownTypeHandlerName } from '@wordpress/blocks';

import { createStore } from 'redux';
import { DataSource } from 'react-native-recyclerview-list';

import { reducer } from './reducers';

import * as UnsupportedBlock from '../block-types/unsupported-block/';

export type BlockType = {
	clientId: string,
	name: string,
	isValid: boolean,
	attributes: Object,
	innerBlocks: Array<BlockType>,
	focused: boolean,
};

export type StateType = {
	blocks: Array<BlockType>,
	listAnimator: DataSource,
	focusedIndex: ?number,
	refresh: boolean,
};

export function newListAnimator( blocks: Array<BlockType> ): DataSource {
	return new DataSource(
		blocks,
		( item: BlockType ) => item.clientId,
		( index ) => blocks[ index ],
		() => blocks.length
	);
}

export function setListAnimatorCallbacks( listAnimator: DataSource, blocks: Array<BlockType> ) {
	listAnimator.setGetter( ( index ) => blocks[ index ] );
	listAnimator.setSizer( () => blocks.length );
}

registerCoreBlocks();
registerBlockType( UnsupportedBlock.name, UnsupportedBlock.settings );
setUnknownTypeHandlerName( UnsupportedBlock.name );

const initialHtml = `
<!-- wp:image -->
<figure class="wp-block-image"><img alt=""/></figure>
<!-- /wp:image -->

<!-- wp:image -->
<figure class="wp-block-image"><img src="https://cldup.com/cXyG__fTLN.jpg" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:title -->
Hello World
<!-- /wp:title -->

<!-- wp:heading {"level": 2} -->
<h2>Welcome to Gutenberg</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><b>Hello</b> World!</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"dropCap":true,"backgroundColor":"vivid-red","fontSize":"large","className":"custom-class-1 custom-class-2"} -->
<p class="has-background has-drop-cap has-large-font-size has-vivid-red-background-color custom-class-1 custom-class-2">
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer tempor tincidunt sapien, quis dictum orci sollicitudin quis. Proin sed elit id est pulvinar feugiat vitae eget dolor. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
<!-- /wp:paragraph -->


<!-- wp:code -->
<pre class="wp-block-code"><code>if name == "World":
    return "Hello World"
else:
    return "Hello Pony"</code></pre>
<!-- /wp:code -->

<!-- wp:more -->
<!--more-->
<!-- /wp:more -->

<!-- wp:p4ragraph -->
Лорем ипсум долор сит амет, адиписци трацтатос еа еум. Меа аудиам малуиссет те, хас меис либрис елеифенд ин. Нец ех тота деленит сусципит. Яуас порро инструцтиор но нец.
<!-- /wp:p4ragraph -->
`;

const initialBlocks = parse( initialHtml ).map( ( block ) => ( { ...block, focused: false } ) );

export const initialState: StateType = {
	// TODO: get blocks list block state should be externalized (shared with Gutenberg at some point?).
	// If not it should be created from a string parsing (commented HTML to json).
	blocks: initialBlocks,
	listAnimator: newListAnimator( initialBlocks ),
	focusedIndex: undefined,
	refresh: false,
};

const devToolsEnhancer =
	// ( 'development' === process.env.NODE_ENV && require( 'remote-redux-devtools' ).default ) ||
	() => {};

export function setupStore( state: StateType = initialState ) {
	const store = createStore( reducer, state, devToolsEnhancer() );
	return store;
}
