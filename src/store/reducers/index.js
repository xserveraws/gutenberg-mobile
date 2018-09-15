/**
 * @format
 * @flow
 */

import { find, findIndex, reduce } from 'lodash';

import ActionTypes from '../actions/ActionTypes';
import { newListAnimator, setListAnimatorCallbacks } from '../';

// TODO: try to get eslint-plugin-import to work
// Disable reason: GB eslint config doesn't handle Flow type imports alongside normal imports.
/* eslint-disable no-duplicate-imports */
import type { StateType } from '../';

import type { BlockActionType } from '../actions';
import { parse } from '@wordpress/blocks';

function findBlock( blocks, clientId: string ) {
	return find( blocks, ( obj ) => {
		return obj.clientId === clientId;
	} );
}

function findBlockIndex( blocks, clientId: string ) {
	return findIndex( blocks, ( obj ) => {
		return obj.clientId === clientId;
	} );
}

/*
 * insert block into blocks[], below / after block having clientIdAbove
*/
function insertBlock( blocks, block, clientIdAbove ): number {
	// TODO we need to set focused: true and search for the currently focused block and
	// set that one to `focused: false`.
	const index = findBlockIndex( blocks, clientIdAbove ) + 1;
	blocks.splice( index, 0, block );
	return index;
}

const emptyBlocksList = [];

export const reducer = (
	state: StateType = {
		blocks: emptyBlocksList,
		listAnimator: newListAnimator( emptyBlocksList ),
		focusedIndex: undefined,
		refresh: false,
	},
	action: BlockActionType
) => {
	const blocks = [ ...state.blocks ];
	setListAnimatorCallbacks( state.listAnimator, blocks );
	switch ( action.type ) {
		case ActionTypes.BLOCK.UPDATE_ATTRIBUTES: {
			const block = findBlock( blocks, action.clientId );

			// Ignore updates if block isn't known
			if ( ! block ) {
				return state;
			}

			// Consider as updates only changed values
			const nextAttributes = reduce(
				action.attributes,
				( result, value, key ) => {
					if ( value !== result[ key ] ) {
						// Avoid mutating original block by creating shallow clone
						if ( result === findBlock( blocks, action.clientId ).attributes ) {
							result = { ...result };
						}

						result[ key ] = value;
					}

					return result;
				},
				findBlock( blocks, action.clientId ).attributes
			);

			// Skip update if nothing has been changed. The reference will
			// match the original block if `reduce` had no changed values.
			if ( nextAttributes === findBlock( blocks, action.clientId ).attributes ) {
				return state;
			}

			// Otherwise merge attributes into state
			const index = findBlockIndex( blocks, action.clientId );
			const updatedBlock = {
				...block,
				attributes: nextAttributes,
			};
			blocks[ index ] = updatedBlock;
			state.listAnimator.set( index, updatedBlock );
			return {
				...state,
				blocks: blocks,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.FOCUS: {
			const destBlockIndex = findBlockIndex( blocks, action.clientId );

			if ( state.focusedIndex && state.focusedIndex !== destBlockIndex ) {
				const lastFocusedBlock = blocks[ state.focusedIndex ];
				lastFocusedBlock.focused = false;
				state.listAnimator.set( state.focusedIndex, lastFocusedBlock );
			}

			const destBlock = blocks[ destBlockIndex ];

			// Select or deselect pressed block
			destBlock.focused = ! destBlock.focused;
			state.listAnimator.set( destBlockIndex, destBlock );
			return {
				...state,
				blocks: blocks,
				focusedIndex: destBlock.focused ? destBlockIndex : undefined,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.MOVE_UP: {
			if ( blocks[ 0 ].clientId === action.clientId ) {
				return state;
			}

			const index = findBlockIndex( blocks, action.clientId );
			const tmp = blocks[ index ];
			blocks[ index ] = blocks[ index - 1 ];
			blocks[ index - 1 ] = tmp;
			state.listAnimator.moveUp( index );
			return {
				...state,
				blocks: blocks,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.MOVE_DOWN: {
			if ( blocks[ blocks.length - 1 ].clientId === action.clientId ) {
				return state;
			}

			const index = findBlockIndex( blocks, action.clientId );
			const tmp = blocks[ index ];
			blocks[ index ] = blocks[ index + 1 ];
			blocks[ index + 1 ] = tmp;
			state.listAnimator.moveDown( index );
			return {
				...state,
				blocks: blocks,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.DELETE: {
			const index = findBlockIndex( blocks, action.clientId );
			blocks.splice( index, 1 );
			state.listAnimator.splice( index, 1 );
			return {
				...state,
				blocks: blocks,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.CREATE: {
			// TODO we need to set focused: true and search for the currently focused block and
			// set that one to `focused: false`.
			const index = insertBlock( blocks, action.block, action.clientIdAbove );
			state.listAnimator.splice( index, 0, action.block );
			return {
				...state,
				blocks: blocks,
				refresh: ! state.refresh,
			};
		}
		case ActionTypes.BLOCK.PARSE: {
			const parsed = parse( action.html );
			return {
				...state,
				blocks: parsed,
				listAnimator: newListAnimator( parsed ),
				refresh: ! state.refresh,
			};
		}
		default:
			return state;
	}
};
