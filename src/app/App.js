/** @flow
 * @format */

import '../globals';

import React from 'react';

// Gutenberg imports
import { withDispatch } from '@wordpress/data';
import { parse, serialize } from '@wordpress/blocks';
import { registerCoreBlocks } from '@wordpress/block-library';
import { registerBlockType, setUnregisteredTypeHandlerName } from '@wordpress/blocks';

import type BlockType from '../store/types';
import AppContainer from './AppContainer';

import initialHtml from './initial-html';

import * as UnsupportedBlock from '../block-types/unsupported-block/';

registerCoreBlocks();
registerBlockType( UnsupportedBlock.name, UnsupportedBlock.settings );
setUnregisteredTypeHandlerName( UnsupportedBlock.name );

type PropsType = {
	onResetBlocks: Array<BlockType> => mixed,
};

class AppProvider extends React.Component<PropsType> {
	constructor( props: PropsType ) {
		super( props );

		const blocksFromHtml = parse( initialHtml );

		// initialize gutenberg store with local store
		// TODO: use `setupEditorState` instead
		props.onResetBlocks( blocksFromHtml );
	}

	render() {
		return (
			<AppContainer />
		);
	}
}

export default withDispatch( ( dispatch ) => {
	const {
		resetBlocks,
	} = dispatch( 'core/editor' );
	return {
		onResetBlocks: resetBlocks,
	};
} )( AppProvider );
