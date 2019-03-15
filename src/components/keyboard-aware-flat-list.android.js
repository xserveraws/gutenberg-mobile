/**
* @format
* @flow
*/
import { FlatList } from 'react-native';
import KeyboardAvoidingView from '../components/keyboard-avoiding-view';

type PropsType = {
	...FlatList.propTypes,
	shouldPreventAutomaticScroll: void => boolean,
	blockToolbarHeight: number,
	innerToolbarHeight: number,
	innerRef?: Function,
}

export const KeyboardAwareFlatList = ( props: PropsType ) => {
	const {
		innerRef,
	} = props;

	return (
		<KeyboardAvoidingView style={ { flex: 1 } }
			innerRef={ ( ref ) => {
				innerRef( ref );
			} }
		>
			<FlatList { ...props } />
		</KeyboardAvoidingView>
	);
};

export const handleCaretVerticalPositionChange = () => {
	//no need to handle on Android, it is system managed
};

export default { KeyboardAwareFlatList, handleCaretVerticalPositionChange };
