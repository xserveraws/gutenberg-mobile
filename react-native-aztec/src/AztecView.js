/**
 * @format
 * @flow
 */

/**
 * External dependencies
 */
import * as React from 'react';
import ReactNative, { requireNativeComponent, ViewPropTypes, UIManager, TouchableWithoutFeedback, GestureResponderEvent } from 'react-native';
import TextInputState from 'react-native/lib/TextInputState';

const AztecManager = UIManager.getViewManagerConfig( 'RCTAztecView' );

type PropsType = {
	activeFormats: Array<mixed>,
	isSelected: boolean,
	disableGutenbergMode: boolean,
	text: string,
	placeholder: string,
	placeholderTextColor: string,
	color: string,
	maxImagesWidth: number,
	minImagesWidth: number,
	onFocus: GestureResponderEvent => void,
	onBlur: any => void,
	onContentSizeChange: any => void,
	onEnter: any => void,
	onBackspace: any => void,
	onSelectionChange: ( number, number, string, any ) => void,
	onHTMLContentWithCursor: ( string, number, number ) => void,
	onCaretVerticalPositionChange: ( React.Node, number, number ) => void,
	blockType: mixed,
	...ViewPropTypes, // include the default view properties
}

type StateType = {
};

class AztecView extends React.Component<PropsType, StateType> {
	selectionEndCaretY: ?number;

	dispatch( command: string, params: mixed ) {
		params = params || [];
		UIManager.dispatchViewManagerCommand(
			ReactNative.findNodeHandle( this ),
			command,
			params,
		);
	}

	requestHTMLWithCursor() {
		this.dispatch( AztecManager.Commands.returnHTMLWithCursor );
	}

	_onContentSizeChange = ( event: any ) => {
		if ( ! this.props.onContentSizeChange ) {
			return;
		}
		const size = event.nativeEvent.contentSize;
		const { onContentSizeChange } = this.props;
		onContentSizeChange( size );
	}

	_onEnter = ( event: any ) => {
		if ( ! this.props.onEnter ) {
			return;
		}

		const { onEnter } = this.props;
		onEnter( event );
	}

	_onBackspace = ( event: any ) => {
		if ( ! this.props.onBackspace ) {
			return;
		}

		const { onBackspace } = this.props;
		onBackspace( event );
	}

	_onHTMLContentWithCursor = ( event: any ) => {
		if ( ! this.props.onHTMLContentWithCursor ) {
			return;
		}

		const text = event.nativeEvent.text;
		const selectionStart = event.nativeEvent.selectionStart;
		const selectionEnd = event.nativeEvent.selectionEnd;
		const { onHTMLContentWithCursor } = this.props;
		onHTMLContentWithCursor( text, selectionStart, selectionEnd );
	}

	_onFocus = ( event: GestureResponderEvent ) => {
		if ( ! this.props.onFocus ) {
			return;
		}

		const { onFocus } = this.props;
		onFocus( event );
	}

	_onBlur = ( event: any ) => {
		this.selectionEndCaretY = null;
		TextInputState.blurTextInput( ReactNative.findNodeHandle( this ) );

		if ( ! this.props.onBlur ) {
			return;
		}

		const { onBlur } = this.props;
		onBlur( event );
	}

	_onSelectionChange = ( event: any ) => {
		if ( this.props.onSelectionChange ) {
			const { selectionStart, selectionEnd, text } = event.nativeEvent;
			const { onSelectionChange } = this.props;
			onSelectionChange( selectionStart, selectionEnd, text, event );
		}

		if ( this.props.onCaretVerticalPositionChange &&
			this.selectionEndCaretY !== event.nativeEvent.selectionEndCaretY ) {
			const caretY = event.nativeEvent.selectionEndCaretY;
			this.props.onCaretVerticalPositionChange( event.target, caretY, this.selectionEndCaretY );
			this.selectionEndCaretY = caretY;
		}
	}

	blur = () => {
		TextInputState.blurTextInput( ReactNative.findNodeHandle( this ) );
	}

	focus = () => {
		TextInputState.focusTextInput( ReactNative.findNodeHandle( this ) );
	}

	isFocused = () => {
		const focusedField = TextInputState.currentlyFocusedField();
		return focusedField && ( focusedField === ReactNative.findNodeHandle( this ) );
	}

	_onPress = ( event: GestureResponderEvent ) => {
		this.focus(); // Call to move the focus in RN way (TextInputState)
		this._onFocus( event ); // Check if there are listeners set on the focus event
	}

	render() {
		// eslint-disable-next-line no-unused-vars
		const { onActiveFormatsChange, ...otherProps } = this.props;
		return (
			<TouchableWithoutFeedback onPress={ this._onPress }>
				<RCTAztecView { ...otherProps }
					onContentSizeChange={ this._onContentSizeChange }
					onHTMLContentWithCursor={ this._onHTMLContentWithCursor }
					onSelectionChange={ this._onSelectionChange }
					onEnter={ this._onEnter }
					// IMPORTANT: the onFocus events are thrown away as these are handled by onPress() in the upper level.
					// It's necessary to do this otherwise onFocus may be set by `{...otherProps}` and thus the onPress + onFocus
					// combination generate an infinite loop as described in https://github.com/wordpress-mobile/gutenberg-mobile/issues/302
					onFocus={ () => {} }
					onBlur={ this._onBlur }
					onBackspace={ this._onBackspace }
				/>
			</TouchableWithoutFeedback>
		);
	}
}

const RCTAztecView = requireNativeComponent( 'RCTAztecView', AztecView );

export default AztecView;
