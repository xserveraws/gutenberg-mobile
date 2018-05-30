/**
 * @format
 * @flow
 */

import React from 'react';
import { View, Text, TextInput, TouchableWithoutFeedback } from 'react-native';
import RCTAztecView from 'react-native-aztec';
import Toolbar from './toolbar';

import type { BlockType } from '../store/';

import styles from './block-holder.scss';

// Gutenberg imports
import { getBlockType } from '@gutenberg/blocks/api';

type PropsType = BlockType & {
	onChange: ( uid: string, attributes: mixed ) => void,
	onToolbarButtonPressed: ( button: number, uid: string ) => void,
	onBlockHolderPressed: ( uid: string ) => void,
};
type StateType = {
	selected: boolean,
	focused: boolean,
	htmltext: string,
	aztectext: string,
	aztecheight: number,
};

const _minHeight = 50;

export default class BlockHolder extends React.Component<PropsType, StateType> {
	constructor( props: PropsType ) {
		super( props );
		this.state = {
			selected: false,
			focused: false,
			htmltext: props.attributes.content,
			aztectext: props.attributes.content,
			aztecheight: _minHeight,
		};
	}

	renderToolbarIfBlockFocused() {
		if ( this.props.focused ) {
			return (
				<Toolbar uid={ this.props.uid } onButtonPressed={ this.props.onToolbarButtonPressed } />
			);
		}

		// Return empty view, toolbar won't be rendered
		return <View />;
	}

	getBlockForType() {
		const blockType = getBlockType( this.props.name );
		if ( blockType ) {
			const Block = blockType.edit;

			let style;
			if ( blockType.name === 'core/code' ) {
				style = styles.block_code;
			}

			// TODO: setAttributes needs to change the state/attributes
			return (
				<Block
					attributes={ { ...this.props.attributes } }
					// pass a curried version of onChanged with just one argument
					setAttributes={ ( attrs ) => this.props.onChange( this.props.uid, attrs ) }
					isSelected={ this.props.focused }
					style={ style }
				/>
			);
		} else if ( this.props.name === 'aztec' ) {
			return (
				<View>
					<TouchableWithoutFeedback
						accessibilityLabel="sync-to-aztec"
						onPress={ () => {
							this.props.onChange( this.props.uid, {
								...this.props.attributes,
								content: this.state.htmltext,
							} );
							this.setState( { ...this.state, aztectext: this.state.htmltext } );
						} }
					>
						<View>
							<Text>Tap here to sync to Aztec</Text>
						</View>
					</TouchableWithoutFeedback>
					<TouchableWithoutFeedback
						accessibilityLabel="sync-from-aztec"
						onPress={ () => {
							this.props.onChange( this.props.uid, {
								...this.props.attributes,
								content: this.state.aztectext,
							} );
							this.setState( { ...this.state, htmltext: this.state.aztectext } );
						} }
					>
						<View>
							<Text>Tap here to sync from Aztec</Text>
						</View>
					</TouchableWithoutFeedback>
					<TextInput
						accessibilityLabel="aztec-html"
						value={ this.state.htmltext }
						onChangeText={ ( text ) => {
							this.setState( { ...this.state, htmltext: text } );
						} }
					/>
					<RCTAztecView
						accessibilityLabel="aztec-view"
						style={ [
							styles[ 'aztec-editor' ],
							{ minHeight: Math.max( _minHeight, this.state.aztecheight ) },
						] }
						text={ this.state.aztectext }
						onContentSizeChange={ ( event ) => {
							this.setState( { ...this.state, aztecheight: event.nativeEvent.contentSize.height } );
						} }
						onChange={ ( event ) => {
							this.setState( { ...this.state, aztectext: event.nativeEvent.text } );
						} }
						color={ 'black' }
						maxImagesWidth={ 200 }
					/>
				</View>
			);
		}

		// Default block placeholder
		return <Text>{ this.props.attributes.content }</Text>;
	}

	render() {
		return (
			<TouchableWithoutFeedback
				onPress={ this.props.onBlockHolderPressed.bind( this, this.props.uid ) }
			>
				<View style={ styles.blockHolder }>
					<View style={ styles.blockTitle }>
						<Text>BlockType: { this.props.name }</Text>
					</View>
					<View style={ styles.blockContainer }>{ this.getBlockForType.bind( this )() }</View>
					{ this.renderToolbarIfBlockFocused.bind( this )() }
				</View>
			</TouchableWithoutFeedback>
		);
	}
}
