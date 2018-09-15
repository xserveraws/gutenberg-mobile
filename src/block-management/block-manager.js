/**
 * @format
 * @flow
 */

import React from 'react';
import { find } from 'lodash';
import {
	Platform,
	Switch,
	Text,
	View,
	FlatList,
	TextInput,
	KeyboardAvoidingView,
} from 'react-native';
import RecyclerViewList, { DataSource } from 'react-native-recyclerview-list';
import BlockHolder from './block-holder';
import { ToolbarButton } from './constants';
import type { BlockType } from '../store/';
import styles from './block-manager.scss';
import BlockPicker from './block-picker';

// Gutenberg imports
import { createBlock, serialize } from '@wordpress/blocks';

export type BlockListType = {
	onChange: ( clientId: string, attributes: mixed ) => void,
	focusBlockAction: string => mixed,
	moveBlockUpAction: string => mixed,
	moveBlockDownAction: string => mixed,
	deleteBlockAction: string => mixed,
	createBlockAction: ( string, BlockType, string ) => mixed,
	parseBlocksAction: string => mixed,
	blocks: Array<BlockType>,
	listAnimator: DataSource,
	aztechtml: string,
	refresh: boolean,
};

type PropsType = BlockListType;
type StateType = {
	// dataSource: DataSource,
	showHtml: boolean,
	inspectBlocks: boolean,
	blockTypePickerVisible: boolean,
	selectedBlockType: string,
};

export default class BlockManager extends React.Component<PropsType, StateType> {
	_htmlTextInput: TextInput = null;

	constructor( props: PropsType ) {
		super( props );
		this.state = {
			// dataSource: new DataSource( this.props.blocks, ( item: BlockType ) => item.clientId ),
			showHtml: false,
			inspectBlocks: false,
			blockTypePickerVisible: false,
			selectedBlockType: 'core/paragraph', // just any valid type to start from
		};
	}

	onBlockHolderPressed( clientId: string ) {
		this.props.focusBlockAction( clientId );
	}

	findFocusedBlock() {
		return find( this.props.blocks, ( obj ) => {
			return obj.focused === true;
		} );
	}

	// TODO: in the near future this will likely be changed to onShowBlockTypePicker and bound to this.props
	// once we move the action to the toolbar
	showBlockTypePicker( show: boolean ) {
		this.setState( { ...this.state, blockTypePickerVisible: show } );
	}

	onBlockTypeSelected( itemValue: string ) {
		this.setState( { ...this.state, selectedBlockType: itemValue, blockTypePickerVisible: false } );

		// find currently focused block
		const clientIdFocused = this.findFocusedBlock().clientId;

		// create an empty block of the selected type
		const newBlock = createBlock( itemValue, {
			content: 'new test text for a ' + itemValue + ' block',
		} );
		newBlock.focused = false;

		// set it into the datasource, and use the same object instance to send it to props/redux
		// this.state.dataSource.splice( focusedItemIndex + 1, 0, newBlock );
		this.props.createBlockAction( newBlock.clientId, newBlock, clientIdFocused );

		// now set the focus
		this.props.focusBlockAction( newBlock.clientId );
	}

	onToolbarButtonPressed( button: number, clientId: string ) {
		switch ( button ) {
			case ToolbarButton.UP:
				// this.state.dataSource.moveUp( dataSourceBlockIndex );
				this.props.moveBlockUpAction( clientId );
				break;
			case ToolbarButton.DOWN:
				// this.state.dataSource.moveDown( dataSourceBlockIndex );
				this.props.moveBlockDownAction( clientId );
				break;
			case ToolbarButton.DELETE:
				// this.state.dataSource.splice( dataSourceBlockIndex, 1 );
				this.props.deleteBlockAction( clientId );
				break;
			case ToolbarButton.PLUS:
				this.showBlockTypePicker( true );
				break;
			case ToolbarButton.SETTINGS:
				// TODO: implement settings
				break;
		}
	}

	serializeToHtml() {
		return this.props.blocks
			.map( ( block ) => {
				if ( block.name === 'aztec' ) {
					return '<aztec>' + block.attributes.content + '</aztec>\n\n';
				}

				return serialize( [ block ] ) + '\n\n';
			} )
			.reduce( ( prevVal, value ) => {
				return prevVal + value;
			}, '' );
	}

	parseHTML( html: string ) {
		const { parseBlocksAction } = this.props;
		parseBlocksAction( html );
	}

	componentDidUpdate() {
		// signal the RecyclerViewList to update as well
		this.props.listAnimator.setDirty();
	}

	onChange( clientId: string, attributes: mixed ) {
		// Update Redux store
		this.props.onChange( clientId, attributes );
	}

	renderList() {
		let list;
		const behavior = Platform.OS === 'ios' ? 'padding' : null;
		if ( Platform.OS === 'android' ) {
			list = (
				<RecyclerViewList
					style={ styles.list }
					dataSource={ this.props.listAnimator }
					renderItem={ this.renderItem.bind( this ) }
					ListEmptyComponent={
						<View style={ { borderColor: '#e7e7e7', borderWidth: 10, margin: 10, padding: 20 } }>
							<Text style={ { fontSize: 15 } }>No blocks :(</Text>
						</View>
					}
				/>
			);
		} else {
			// TODO: we won't need this. This just a temporary solution until we implement the RecyclerViewList native code for iOS
			list = (
				<FlatList
					style={ styles.list }
					data={ this.props.blocks }
					extraData={ ( this.props.refresh, this.state.inspectBlocks ) }
					keyExtractor={ ( item ) => item.clientId }
					renderItem={ this.renderItem.bind( this ) }
				/>
			);
		}
		return (
			<KeyboardAvoidingView style={ { flex: 1 } } behavior={ behavior }>
				{ list }
			</KeyboardAvoidingView>
		);
	}

	render() {
		const list = this.renderList();
		const blockTypePicker = (
			<BlockPicker
				visible={ this.state.blockTypePickerVisible }
				onDismiss={ () => {
					this.showBlockTypePicker( false );
				} }
				onValueSelected={ ( itemValue ) => {
					this.onBlockTypeSelected( itemValue );
				} }
			/>
		);

		return (
			<View style={ styles.container }>
				<View style={ styles.switch }>
					<Switch
						activeText={ 'On' }
						inActiveText={ 'Off' }
						value={ this.state.showHtml }
						onValueChange={ this.handleSwitchEditor }
					/>
					<Text style={ styles.switchLabel }>View html output</Text>
					<Switch
						activeText={ 'On' }
						inActiveText={ 'Off' }
						value={ this.state.inspectBlocks }
						onValueChange={ this.handleInspectBlocksChanged }
					/>
					<Text style={ styles.switchLabel }>Inspect blocks</Text>
				</View>
				{ this.state.showHtml && this.renderHTML() }
				{ ! this.state.showHtml && list }
				{ blockTypePicker }
			</View>
		);
	}

	handleSwitchEditor = ( showHtml: boolean ) => {
		if ( ! showHtml ) {
			const html = this._htmlTextInput._lastNativeText;
			this.parseHTML( html );
		}

		this.setState( { showHtml } );
	};

	handleInspectBlocksChanged = ( inspectBlocks: boolean ) => {
		this.setState( { inspectBlocks } );
	};

	renderItem( value: { item: BlockType, clientId: string } ) {
		const insertHere = (
			<View style={ styles.containerStyleAddHere }>
				<View style={ styles.lineStyleAddHere } />
				<Text style={ styles.labelStyleAddHere }>ADD BLOCK HERE</Text>
				<View style={ styles.lineStyleAddHere } />
			</View>
		);

		return (
			<View>
				<BlockHolder
					key={ value.clientId }
					onToolbarButtonPressed={ this.onToolbarButtonPressed.bind( this ) }
					onBlockHolderPressed={ this.onBlockHolderPressed.bind( this ) }
					onChange={ this.onChange.bind( this ) }
					showTitle={ this.state.inspectBlocks }
					focused={ value.item.focused }
					clientId={ value.clientId }
					{ ...value.item }
				/>
				{ this.state.blockTypePickerVisible && value.item.focused && insertHere }
			</View>
		);
	}

	renderHTML() {
		const behavior = Platform.OS === 'ios' ? 'padding' : null;
		const htmlInputRef = ( el ) => ( this._htmlTextInput = el );
		return (
			<KeyboardAvoidingView style={ { flex: 1 } } behavior={ behavior }>
				<TextInput
					textAlignVertical="top"
					multiline
					ref={ htmlInputRef }
					numberOfLines={ 0 }
					style={ styles.htmlView }
					value={ this.serializeToHtml() }
				/>
			</KeyboardAvoidingView>
		);
	}
}
