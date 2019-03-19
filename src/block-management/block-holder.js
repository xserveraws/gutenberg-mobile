/**
* @format
* @flow
*/

import React from 'react';
import {
	View,
	Text,
	TouchableWithoutFeedback,
	NativeSyntheticEvent,
	NativeTouchEvent,
	Platform,
} from 'react-native';
import InlineToolbar, { InlineToolbarActions } from './inline-toolbar';
import {
	requestImageUploadCancel,
} from 'react-native-gutenberg-bridge';

/**
 * WordPress dependencies
 */
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { addAction, removeAction, hasAction } from '@wordpress/hooks';

import type { BlockType } from '../store/types';

import styles from './block-holder.scss';

// Gutenberg imports
import { getBlockType } from '@wordpress/blocks';
import { BlockEdit } from '@wordpress/block-editor';

import TextInputState from 'react-native/lib/TextInputState';

type PropsType = BlockType & {
	clientId: string,
	rootClientId: string,
	isSelected: boolean,
	isFirstBlock: boolean,
	isLastBlock: boolean,
	showTitle: boolean,
	borderStyle: Object,
	focusedBorderColor: string,
	selectedBlockClientId: string,
	onFocus: () => void,
	onBlur: () => void,
	getBlockIndex: ( clientId: string, rootClientId: string ) => number,
	getPreviousBlockClientId: ( clientId: string ) => string,
	getNextBlockClientId: ( clientId: string ) => string,
	getBlockName: ( clientId: string ) => string,
	onChange: ( attributes: mixed ) => void,
	onInsertBlocks: ( blocks: Array<Object>, index: number ) => void,
	onCaretVerticalPositionChange: ( targetId: number, caretY: number, previousCaretY: ?number ) => void,
	onReplace: ( blocks: Array<Object> ) => void,
	onSelect: ( clientId: string, clearCurrentSelection: boolean ) => void,
	mergeBlocks: ( clientId: string, clientId: string ) => void,
	moveBlockUp: () => void,
	moveBlockDown: () => void,
	removeBlock: () => void,
};

type StateType = {
	isFullyBordered: boolean;
}

export class BlockHolder extends React.Component<PropsType, StateType> {
	_isSplitting: boolean;

	constructor( props: PropsType ) {
		super( props );
		this._isSplitting = false;
		this.state = {
			isFullyBordered: false,
		};
	}

	onFocus = ( event: NativeSyntheticEvent<NativeTouchEvent> ) => {
		this._isSplitting || this.props.onFocus();
		this._isSplitting = false;

		if ( event ) {
			// == Hack for the Alpha ==
			// When moving the focus from a TextInput field to another kind of field the call that hides the keyboard is not invoked
			// properly, resulting in keyboard up when it should not be there.
			// The code below dismisses the keyboard (calling blur on the last TextInput field) when the field that now gets the focus is a non-textual field
			const currentlyFocusedTextInput = TextInputState.currentlyFocusedField();
			if ( event.nativeEvent.target !== currentlyFocusedTextInput && ! TextInputState.isTextInput( event.nativeEvent.target ) ) {
				TextInputState.blurTextInput( currentlyFocusedTextInput );
			}
		}

		const { selectedBlockClientId, clientId, onSelect } = this.props;
		const isSelectingAlreadySelected = selectedBlockClientId && selectedBlockClientId === clientId;

		if ( isSelectingAlreadySelected ) {
			return;
		}
		const deselectCurrent = selectedBlockClientId ? ( selectedBlockClientId !== clientId ) : false;
		onSelect( clientId, deselectCurrent );
	};

	onBlur = () => {
		this._isSplitting || this.props.onBlur();
	}

	onRemoveBlockCheckUpload = ( mediaId: number ) => {
		if ( hasAction( 'blocks.onRemoveBlockCheckUpload' ) ) {
			// now remove the action as it's  a one-shot use and won't be needed anymore
			removeAction( 'blocks.onRemoveBlockCheckUpload', 'gutenberg-mobile/blocks' );
			requestImageUploadCancel( mediaId );
		}
	}

	onInlineToolbarButtonPressed = ( button: number ) => {
		switch ( button ) {
			case InlineToolbarActions.UP:
				this.props.moveBlockUp();
				break;
			case InlineToolbarActions.DOWN:
				this.props.moveBlockDown();
				break;
			case InlineToolbarActions.DELETE:
				// adding a action that will exist for as long as it takes for the block to be removed and the component unmounted
				// this acts as a flag for the code using the action to know of its existence
				addAction( 'blocks.onRemoveBlockCheckUpload', 'gutenberg-mobile/blocks', this.onRemoveBlockCheckUpload );
				this.props.removeBlock();
				break;
		}
	};

	insertBlocksAfter = ( blocks: Array<Object> ) => {
		// Avoid propagating blur/focus when splitting.
		this._isSplitting = true;
		const order = this.props.getBlockIndex( this.props.clientId, this.props.rootClientId );
		this.props.onInsertBlocks( blocks, order + 1 );
	};

	mergeBlocks = ( forward: boolean = false ) => {
		const {
			clientId,
			getPreviousBlockClientId,
			getNextBlockClientId,
			mergeBlocks,
		} = this.props;

		const previousBlockClientId = getPreviousBlockClientId( clientId );
		const nextBlockClientId = getNextBlockClientId( clientId );

		// Do nothing when it's the first block.
		if (
			( ! forward && ! previousBlockClientId ) ||
			( forward && ! nextBlockClientId )
		) {
			return;
		}

		if ( forward ) {
			mergeBlocks( clientId, nextBlockClientId );
		} else {
			const name = this.props.getBlockName( previousBlockClientId );
			const blockType = getBlockType( name );
			// The default implementation does only focus the previous block if it's not mergeable
			// We don't want to move the focus for now, just keep for and caret at the beginning of the current block.
			if ( ! blockType.merge ) {
				return;
			}
			mergeBlocks( previousBlockClientId, clientId );
		}
	};

	renderToolbar() {
		if ( ! this.props.isSelected ) {
			return null;
		}

		return (
			<InlineToolbar
				clientId={ this.props.clientId }
				onButtonPressed={ this.onInlineToolbarButtonPressed }
				canMoveUp={ ! this.props.isFirstBlock }
				canMoveDown={ ! this.props.isLastBlock }
			/>
		);
	}

	getBlockForType() {
		return (
			<BlockEdit
				name={ this.props.name }
				isSelected={ this.props.isSelected }
				attributes={ this.props.attributes }
				setAttributes={ this.props.onChange }
				onFocus={ this.onFocus }
				onBlur={ this.onBlur }
				onReplace={ this.props.onReplace }
				insertBlocksAfter={ this.insertBlocksAfter }
				mergeBlocks={ this.mergeBlocks }
				onCaretVerticalPositionChange={ this.props.onCaretVerticalPositionChange }
			/>
		);
	}

	renderBlockTitle() {
		return (
			<View style={ styles.blockTitle }>
				<Text>BlockType: { this.props.name }</Text>
			</View>
		);
	}

	render() {
		const { isSelected, borderStyle, focusedBorderColor } = this.props;

		const borderColor = isSelected ? focusedBorderColor : 'transparent';

		return (
			<TouchableWithoutFeedback onPress={ this.onFocus } >
				<View style={ [ styles.blockHolder, borderStyle, { borderColor } ] }>
					{ this.props.showTitle && this.renderBlockTitle() }
					<View style={ [ ! isSelected && styles.blockContainer, isSelected && styles.blockContainerFocused ] }>{ this.getBlockForType() }</View>
					{ this.renderToolbar() }
				</View>
			</TouchableWithoutFeedback>
		);
	}
}

export default compose( [
	withSelect( ( select, { clientId, rootClientId } ) => {
		const {
			getBlockAttributes,
			getBlockName,
			getBlockIndex,
			getBlocks,
			getPreviousBlockClientId,
			getNextBlockClientId,
			getSelectedBlockClientId,
			isBlockSelected,
		} = select( 'core/block-editor' );
		const name = getBlockName( clientId );
		const attributes = getBlockAttributes( clientId );
		const order = getBlockIndex( clientId, rootClientId );
		const isSelected = isBlockSelected( clientId );
		const isFirstBlock = order === 0;
		const isLastBlock = order === getBlocks().length - 1;
		const selectedBlockClientId = getSelectedBlockClientId();

		return {
			attributes,
			getBlockIndex,
			getBlockName,
			getPreviousBlockClientId,
			getNextBlockClientId,
			isFirstBlock,
			isLastBlock,
			isSelected,
			name,
			selectedBlockClientId,
		};
	} ),
	withDispatch( ( dispatch, { clientId, rootClientId } ) => {
		const {
			clearSelectedBlock,
			insertBlocks,
			mergeBlocks,
			moveBlocksDown,
			moveBlocksUp,
			removeBlock,
			replaceBlocks,
			selectBlock,
			updateBlockAttributes,
		} = dispatch( 'core/block-editor' );

		return {
			mergeBlocks,
			moveBlockDown() {
				moveBlocksDown( clientId );
			},
			moveBlockUp() {
				moveBlocksUp( clientId );
			},
			removeBlock() {
				removeBlock( clientId );
			},
			onInsertBlocks( blocks: Array<Object>, index: number ) {
				insertBlocks( blocks, index, rootClientId );
			},
			onSelect: ( selectedClientId: string, clearCurrentSelection: boolean ) => {
				clearCurrentSelection && clearSelectedBlock();
				selectBlock( selectedClientId );
			},
			onChange: ( attributes: Object ) => {
				updateBlockAttributes( clientId, attributes );
			},
			onReplace( blocks: Array<Object> ) {
				replaceBlocks( [ clientId ], blocks );
			},
		};
	} ),
] )( BlockHolder );
