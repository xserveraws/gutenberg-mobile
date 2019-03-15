/**
 * @format
 * @flow
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

import React from 'react';
import { identity } from 'lodash';

import { Text, View, Keyboard, LayoutChangeEvent, SafeAreaView, Dimensions } from 'react-native';
import BlockHolder from './block-holder';
import type { BlockType } from '../store/types';
import styles from './block-manager.scss';
import blockHolderStyles from './block-holder.scss';
import inlineToolbarStyles from './inline-toolbar/style.scss';
import toolbarStyles from './block-toolbar.scss';
import BlockPicker from './block-picker';
import HTMLTextInput from '../components/html-text-input';
import BlockToolbar from './block-toolbar';
import KeyboardAvoidingView from '../components/keyboard-avoiding-view';
import { KeyboardAwareFlatList, handleCaretVerticalPositionChange } from '../components/keyboard-aware-flat-list';
import SafeArea from 'react-native-safe-area';

// Gutenberg imports
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { createBlock, isUnmodifiedDefaultBlock } from '@wordpress/blocks';
import { PostTitle } from '@wordpress/editor';
import { DefaultBlockAppender } from '@wordpress/block-editor';
import { sendNativeEditorDidLayout, subscribeSetFocusOnTitle } from 'react-native-gutenberg-bridge';

type PropsType = {
	rootClientId: ?string,
	blockClientIds: Array<string>,
	blockCount: number,
	focusBlock: ( clientId: string ) => void,
	insertBlock: ( block: BlockType, position: number ) => void,
	replaceBlock: ( string, BlockType ) => mixed,
	selectedBlock: ?BlockType,
	selectedBlockClientId: string,
	setTitleAction: string => void,
	selectedBlockOrder: number,
	isBlockSelected: string => boolean,
	showHtml: boolean,
	title: string,
};

type StateType = {
	blockTypePickerVisible: boolean,
	isKeyboardVisible: boolean,
	rootViewHeight: number,
	safeAreaBottomInset: number,
	isFullyBordered: boolean,
};

export class BlockManager extends React.Component<PropsType, StateType> {
	scrollViewRef: Object;
	postTitleRef: ?Object;
	subscriptionParentSetFocusOnTitle: ?Object;
	_isMounted: boolean;

	constructor( props: PropsType ) {
		super( props );

		( this: any ).renderItem = this.renderItem.bind( this );
		( this: any ).shouldFlatListPreventAutomaticScroll = this.shouldFlatListPreventAutomaticScroll.bind( this );
		( this: any ).renderDefaultBlockAppender = this.renderDefaultBlockAppender.bind( this );
		( this: any ).renderHeader = this.renderHeader.bind( this );
		( this: any ).onSafeAreaInsetsUpdate = this.onSafeAreaInsetsUpdate.bind( this );
		( this: any ).onBlockTypeSelected = this.onBlockTypeSelected.bind( this );
		( this: any ).onRootViewLayout = this.onRootViewLayout.bind( this );
		( this: any ).keyboardDidShow = this.keyboardDidShow.bind( this );
		( this: any ).keyboardDidHide = this.keyboardDidHide.bind( this );
		( this: any ).onCaretVerticalPositionChange = this.onCaretVerticalPositionChange.bind( this );
		( this: any ).scrollViewInnerRef = this.scrollViewInnerRef.bind( this );
		( this: any ).onContentViewLayout = this.onContentViewLayout.bind( this );
		( this: any ).focusScrollView = this.focusScrollView.bind( this );

		this.state = {
			blockTypePickerVisible: false,
			isKeyboardVisible: false,
			rootViewHeight: 0,
			safeAreaBottomInset: 0,
			isFullyBordered: false,
		};
		SafeArea.getSafeAreaInsetsForRootView().then( this.onSafeAreaInsetsUpdate );
	}

	// TODO: in the near future this will likely be changed to onShowBlockTypePicker and bound to this.props
	// once we move the action to the toolbar
	showBlockTypePicker( show: boolean ) {
		this.setState( { blockTypePickerVisible: show } );
	}

	onBlockTypeSelected( itemValue: string ) {
		this.setState( { blockTypePickerVisible: false } );

		// create an empty block of the selected type
		const newBlock = createBlock( itemValue );

		// now determine whether we need to replace the currently selected block (if it's empty)
		// or just add a new block as usual
		if ( this.isReplaceable( this.props.selectedBlock ) ) {
			// do replace here
			this.props.replaceBlock( this.props.selectedBlockClientId, newBlock );
		} else {
			const indexAfterSelected = this.props.selectedBlockOrder + 1;
			const insertionIndex = indexAfterSelected || this.props.blockCount;
			this.props.insertBlock( newBlock, insertionIndex );
		}

		// now set the focus
		this.props.focusBlock( newBlock.clientId );
	}

	onSafeAreaInsetsUpdate( result: Object ) {
		const { safeAreaInsets } = result;
		if ( this._isMounted && this.state.safeAreaBottomInset !== safeAreaInsets.bottom ) {
			this.setState( { ...this.state, safeAreaBottomInset: safeAreaInsets.bottom } );
		}
	}

	onRootViewLayout( event: LayoutChangeEvent ) {
		const { height } = event.nativeEvent.layout;
		this.setState( { rootViewHeight: height }, () => {
			sendNativeEditorDidLayout();
		} );
	}

	onContentViewLayout( event: LayoutChangeEvent ) {
		const { width: fullWidth } = Dimensions.get( 'window' );
		const { width } = event.nativeEvent.layout;
		const isFullyBordered = fullWidth > width + 1; //+1 is for not letting fraction differences effect the result on Android
		if ( isFullyBordered !== this.state.isFullyBordered ) {
			this.setState( { ...this.state, isFullyBordered } );
		}
	}

	blockHolderBorderStyle() {
		return this.state.isFullyBordered ? styles.blockHolderFullBordered : styles.blockHolderSemiBordered;
	}

	componentDidMount() {
		this._isMounted = true;
		Keyboard.addListener( 'keyboardDidShow', this.keyboardDidShow );
		Keyboard.addListener( 'keyboardDidHide', this.keyboardDidHide );
		SafeArea.addEventListener( 'safeAreaInsetsForRootViewDidChange', this.onSafeAreaInsetsUpdate );
		this.subscriptionParentSetFocusOnTitle = subscribeSetFocusOnTitle( ( ) => {
			if ( this.postTitleRef ) {
				this.postTitleRef.focus();
			}
		} );
	}

	componentWillUnmount() {
		Keyboard.removeListener( 'keyboardDidShow', this.keyboardDidShow );
		Keyboard.removeListener( 'keyboardDidHide', this.keyboardDidHide );
		SafeArea.removeEventListener( 'safeAreaInsetsForRootViewDidChange', this.onSafeAreaInsetsUpdate );
		if ( this.subscriptionParentSetFocusOnTitle ) {
			this.subscriptionParentSetFocusOnTitle.remove();
		}
		this._isMounted = false;
	}

	keyboardDidShow() {
		this.setState( { isKeyboardVisible: true } );
	}

	keyboardDidHide() {
		this.setState( { isKeyboardVisible: false } );
	}

	onCaretVerticalPositionChange( targetId: number, caretY: number, previousCaretY: ?number ) {
		handleCaretVerticalPositionChange( this.scrollViewRef, targetId, caretY, previousCaretY );
	}

	scrollViewInnerRef( ref: Object ) {
		this.scrollViewRef = ref;
	}

	focusScrollView( ) {
		console.log( 'Cerco di mettere il focus sulla scroll view' );
		//this.scrollViewRef.focus();
	}

	shouldFlatListPreventAutomaticScroll() {
		return this.state.blockTypePickerVisible;
	}

	renderDefaultBlockAppender() {
		return (
			<DefaultBlockAppender
				rootClientId={ this.props.rootClientId }
				containerStyle={ [
					blockHolderStyles.blockContainerFocused,
					this.blockHolderBorderStyle(),
					{ borderColor: 'transparent' },
				] }
			/>
		);
	}

	renderHeader() {
		return (
			<PostTitle
				innerRef={ ( ref ) => {
					this.postTitleRef = ref;
				} }
				title={ this.props.title }
				onUpdate={ this.props.setTitleAction }
				placeholder={ __( 'Add title' ) }
				borderStyle={ this.blockHolderBorderStyle() }
				focusedBorderColor={ styles.blockHolderFocused.borderColor } />
		);
	}

	renderList() {
		return (
			<View style={ { flex: 1 } } onLayout={ this.onContentViewLayout }>
				<KeyboardAwareFlatList
					innerRef={ this.scrollViewInnerRef }
					blockToolbarHeight={ toolbarStyles.container.height }
					innerToolbarHeight={ inlineToolbarStyles.toolbar.height }
					safeAreaBottomInset={ this.state.safeAreaBottomInset }
					parentHeight={ this.state.rootViewHeight }
					keyboardShouldPersistTaps="always"
					style={ styles.list }
					data={ this.props.blockClientIds }
					extraData={ [ this.state.isFullyBordered ] }
					keyExtractor={ identity }
					renderItem={ this.renderItem }
					shouldPreventAutomaticScroll={ this.shouldFlatListPreventAutomaticScroll }
					title={ this.props.title }
					ListHeaderComponent={ this.renderHeader }
					ListEmptyComponent={ this.renderDefaultBlockAppender }
				/>
				<SafeAreaView>
					<View style={ { height: toolbarStyles.container.height } } />
				</SafeAreaView>
				<KeyboardAvoidingView
					style={ styles.blockToolbarKeyboardAvoidingView }
					parentHeight={ this.state.rootViewHeight }
				>
					<BlockToolbar
						onInsertClick={ () => {
							this.showBlockTypePicker( true );
						} }
						showKeyboardHideButton={ this.state.isKeyboardVisible }
					/>
				</KeyboardAvoidingView>
			</View>
		);
	}

	render() {
		return (
			<SafeAreaView style={ styles.container } onLayout={ this.onRootViewLayout }>
				{
					this.props.showHtml ?
						this.renderHTML() :
						this.renderList()
				}
				{ this.state.blockTypePickerVisible && (
					<BlockPicker
						onDismiss={ () => this.showBlockTypePicker( false ) }
						onValueSelected={ this.onBlockTypeSelected }
						isReplacement={ this.isReplaceable( this.props.selectedBlock ) }
						addExtraBottomPadding={ this.state.safeAreaBottomInset === 0 }
					/>
				) }
			</SafeAreaView>
		);
	}

	isReplaceable( block: ?BlockType ) {
		if ( ! block ) {
			return false;
		}
		return isUnmodifiedDefaultBlock( block );
	}

	renderItem( value: { item: string, index: number } ) {
		const clientId = value.item;

		return (
			<View>
				<BlockHolder
					key={ clientId }
					showTitle={ false }
					clientId={ clientId }
					rootClientId={ this.props.rootClientId }
					onCaretVerticalPositionChange={ this.onCaretVerticalPositionChange }
					borderStyle={ this.blockHolderBorderStyle() }
					focusParentView={ this.focusScrollView }
					focusedBorderColor={ styles.blockHolderFocused.borderColor }
				/>
				{ this.state.blockTypePickerVisible && this.props.isBlockSelected( clientId ) && (
					<View style={ styles.containerStyleAddHere } >
						<View style={ styles.lineStyleAddHere }></View>
						<Text style={ styles.labelStyleAddHere } >{ __( 'ADD BLOCK HERE' ) }</Text>
						<View style={ styles.lineStyleAddHere }></View>
					</View>
				) }
			</View>
		);
	}

	renderHTML() {
		return (
			<HTMLTextInput { ...this.props } parentHeight={ this.state.rootViewHeight } />
		);
	}
}

export default compose( [
	withSelect( ( select, { rootClientId } ) => {
		const {
			getBlockCount,
			getBlockIndex,
			getBlockOrder,
			getSelectedBlock,
			getSelectedBlockClientId,
			isBlockSelected,
		} = select( 'core/block-editor' );

		const selectedBlockClientId = getSelectedBlockClientId();

		return {
			blockClientIds: getBlockOrder( rootClientId ),
			blockCount: getBlockCount( rootClientId ),
			isBlockSelected,
			selectedBlock: getSelectedBlock(),
			selectedBlockClientId,
			selectedBlockOrder: getBlockIndex( selectedBlockClientId ),
		};
	} ),
	withDispatch( ( dispatch ) => {
		const {
			clearSelectedBlock,
			insertBlock,
			replaceBlock,
			selectBlock,
		} = dispatch( 'core/block-editor' );

		return {
			insertBlock,
			focusBlock: ( clientId ) => {
				clearSelectedBlock();
				selectBlock( clientId );
			},
			replaceBlock,
		};
	} ),
] )( BlockManager );
