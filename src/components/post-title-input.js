/**
 * @format
 * @flow
 */

import React from 'react';
import { View } from 'react-native';

// Gutenberg imports
import { PostTitle } from '@wordpress/editor';

type PropsType = {
	/*onChange: string => mixed,
	onPersist: string => mixed,
	value: string,
	parentHeight: number,*/
};

type StateType = {
	/*isDirty: boolean,
	value: string,*/
};

export class PostTitleInputView extends React.Component<PropsType, StateType> {
    
    _title: Object;
    
	constructor() {
		super( ...arguments );
	}

    focus () {
        console.log('Focus called');
    }

	render() {
        return (
			<View  /*style={ styles.titleContainer }*/>
                <PostTitle
                    ref={ ( ref ) => {
                        this._title = ref;
                    }
                    }
					//title={ this.props.title }
					//onUpdate={ this.props.setTitleAction }
					placeholder={ 'Add a Title' } />
			</View>
        );
	}
}

export default PostTitleInputView;
