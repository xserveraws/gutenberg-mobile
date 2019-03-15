/**
* @format
* @flow
*/

import React from 'react';
import { View, KeyboardAvoidingView as AndroidKeyboardAvoidingView } from 'react-native';

type PropsType = {
	...View.propTypes,
	innerRef?: Function,
	parentHeight: number,
}

const KeyboardAvoidingView = ( propsType: PropsType ) => {
	const { ...props } = propsType;
	const {
		innerRef,
	} = props;

	return (
		<AndroidKeyboardAvoidingView { ...props }
			ref={ ( ref ) => {
				if ( innerRef ) {
					innerRef( ref );
				}
			} }
		/>
	);
};

export default KeyboardAvoidingView;
